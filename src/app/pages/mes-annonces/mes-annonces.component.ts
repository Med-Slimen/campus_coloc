import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { AnnonceService } from '../../services/annonce.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Annonce } from '../../models';

@Component({
  selector: 'app-mes-annonces',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './mes-annonces.component.html',
  styleUrls: ['./mes-annonces.component.css']
})
export class MesAnnoncesComponent implements OnInit {
  private annonceService = inject(AnnonceService);
  public authService = inject(AuthService);
  private toastService = inject(ToastService);
  public router = inject(Router);

  // Liste des annonces du propriétaire
  annonces: Annonce[] = [];

  // États du chargement et des erreurs
  chargement: boolean = true;
  erreur: string | null = null;

  // Gestion du dialogue modal de confirmation de suppression
  dialogSuppressionOuvert: boolean = false;
  annonceASupprimer: Annonce | null = null;
  actionEnCours: boolean = false;

  // Vérifie si le compte utilisateur est certifié
  get estVerifie(): boolean {
    const user = this.authService.currentUser;
    return user?.statutVerification === 'verifie' || user?.role === 'admin';
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerMesAnnonces();
  }

  // Charge l'ensemble des annonces appartenant à l'utilisateur connecté
  async chargerMesAnnonces(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.chargement = false;
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      this.annonces = await this.annonceService.getByProprietaire(user.uid);
    } catch {
      this.erreur = "Impossible de récupérer vos annonces. Veuillez vérifier votre connexion.";
    } finally {
      this.chargement = false;
    }
  }

  // Calcule le budget estimé par colocataire en dinars tunisiens
  getBudgetPersonne(a: Annonce): number {
    const loyer = a.loyer || 0;
    const charges = a.charges || 0;
    const places = Math.max(1, a.nombrePlaces || 1);
    return Math.round((loyer + charges) / places);
  }

  // Redirige vers la création si le propriétaire est vérifié
  allerNouvelleAnnonce(): void {
    if (!this.estVerifie) {
      this.toastService.avertissement(
        "Vous devez faire certifier votre profil avant de pouvoir déposer une annonce."
      );
      return;
    }
    this.router.navigate(['/mes-annonces/nouvelle']);
  }

  // Bascule l'état d'une annonce entre suspendue et publiée
  async basculerStatut(annonce: Annonce): Promise<void> {
    if (!annonce.id) return;

    this.actionEnCours = true;
    try {
      if (annonce.statut === 'publiee') {
        await this.annonceService.setStatut(annonce.id, 'suspendue');
        annonce.statut = 'suspendue';
        this.toastService.succes("L'annonce a été suspendue temporairement.");
      } else if (annonce.statut === 'suspendue') {
        await this.annonceService.setStatut(annonce.id, 'publiee');
        annonce.statut = 'publiee';
        this.toastService.succes("L'annonce est à nouveau visible en ligne.");
      }
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du changement de statut de l'annonce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Ouvre le dialogue modal de confirmation de suppression
  demanderSuppression(annonce: Annonce): void {
    this.annonceASupprimer = annonce;
    this.dialogSuppressionOuvert = true;
  }

  // Annule la suppression et ferme la modale
  annulerSuppression(): void {
    this.dialogSuppressionOuvert = false;
    this.annonceASupprimer = null;
  }

  // Supprime définitivement l'annonce avec contrôle de présence d'un espace actif
  async confirmerSuppression(): Promise<void> {
    if (!this.annonceASupprimer || !this.annonceASupprimer.id) return;

    const id = this.annonceASupprimer.id;
    this.actionEnCours = true;

    try {
      await this.annonceService.delete(id);
      this.annonces = this.annonces.filter(a => a.id !== id);
      this.toastService.succes("L'annonce a été supprimée avec succès.");
      this.annulerSuppression();
    } catch (err: any) {
      this.toastService.erreur(
        err?.message || "Impossible de supprimer cette annonce."
      );
      this.annulerSuppression();
    } finally {
      this.actionEnCours = false;
    }
  }
}
