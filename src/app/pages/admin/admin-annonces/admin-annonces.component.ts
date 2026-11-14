import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { AnnonceService } from '../../../services/annonce.service';
import { NotificationService } from '../../../services/notification.service';
import { ToastService } from '../../../services/toast.service';
import { Annonce } from '../../../models';

type OngletAnnonce = 'en_attente' | 'publiee' | 'suspendue';

@Component({
  selector: 'app-admin-annonces',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './admin-annonces.component.html',
  styleUrls: ['./admin-annonces.component.css']
})
export class AdminAnnoncesComponent implements OnInit {
  private annonceService = inject(AnnonceService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);

  // Données
  annonces: Annonce[] = [];
  ongletActif: OngletAnnonce = 'en_attente';

  // États d'affichage
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  // Boîte de dialogue pour le refus avec motif obligatoire
  dialogRefusOuvert: boolean = false;
  annonceARefuser: Annonce | null = null;
  motifRefusSaisi: string = '';
  erreurMotif: string | null = null;

  // Aperçu grand format d'une photo
  photoZoom: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.chargerAnnonces();
  }

  // Charge l'ensemble des annonces de la plateforme
  async chargerAnnonces(): Promise<void> {
    this.chargement = true;
    this.erreur = null;
    try {
      this.annonces = await this.annonceService.getAllAnnonces();
    } catch {
      this.erreur = "Impossible de récupérer les annonces pour la modération.";
    } finally {
      this.chargement = false;
    }
  }

  // Filtre les annonces selon l'onglet actif
  get annoncesFiltrees(): Annonce[] {
    return this.annonces.filter(a => a.statut === this.ongletActif);
  }

  // Compteurs pour chaque onglet
  get countEnAttente(): number {
    return this.annonces.filter(a => a.statut === 'en_attente').length;
  }

  get countPubliees(): number {
    return this.annonces.filter(a => a.statut === 'publiee').length;
  }

  get countSuspendues(): number {
    return this.annonces.filter(a => a.statut === 'suspendue').length;
  }

  // Change d'onglet actif
  changerOnglet(onglet: OngletAnnonce): void {
    this.ongletActif = onglet;
  }

  // Calcule le budget par personne pour information
  getBudgetPersonne(a: Annonce): number {
    const loyer = a.loyer || 0;
    const charges = a.charges || 0;
    const places = Math.max(1, a.nombrePlaces || 1);
    return Math.round((loyer + charges) / places);
  }

  // Approuve et publie une annonce
  async approuver(annonce: Annonce): Promise<void> {
    if (!annonce.id) return;
    this.actionEnCours = true;

    try {
      await this.annonceService.validerAnnonce(annonce.id);
      annonce.statut = 'publiee';
      annonce.motifRefus = '';

      // Notification au propriétaire
      await this.notificationService.create({
        userId: annonce.proprietaireId,
        type: 'annonce',
        contenu: `Félicitations ! Votre annonce « ${annonce.titre} » a été vérifiée et publiée sur CampusColoc.`,
        lien: '/mes-annonces',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.succes("L'annonce a été publiée avec succès.");
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de la validation de l'annonce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Ouvre le formulaire de saisie du motif de refus
  ouvrirRefus(annonce: Annonce): void {
    this.annonceARefuser = annonce;
    this.motifRefusSaisi = '';
    this.erreurMotif = null;
    this.dialogRefusOuvert = true;
  }

  // Ferme la modale de refus
  fermerRefus(): void {
    this.dialogRefusOuvert = false;
    this.annonceARefuser = null;
    this.motifRefusSaisi = '';
    this.erreurMotif = null;
  }

  // Valide le refus avec le motif obligatoire
  async confirmerRefus(): Promise<void> {
    if (!this.annonceARefuser || !this.annonceARefuser.id) return;

    const motif = this.motifRefusSaisi.trim();
    if (!motif) {
      this.erreurMotif = "Veuillez préciser la raison du refus pour orienter le propriétaire.";
      return;
    }

    const id = this.annonceARefuser.id;
    const annonce = this.annonceARefuser;
    this.actionEnCours = true;

    try {
      await this.annonceService.refuserAnnonce(id, motif);
      annonce.statut = 'refusee';
      annonce.motifRefus = motif;

      // Notification au propriétaire
      await this.notificationService.create({
        userId: annonce.proprietaireId,
        type: 'annonce',
        contenu: `Votre annonce « ${annonce.titre} » a été refusée pour le motif : ${motif}`,
        lien: '/mes-annonces',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.avertissement("L'annonce a été refusée et le propriétaire notifié.");
      this.fermerRefus();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du refus de l'annonce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Suspend une annonce publiée
  async suspendre(annonce: Annonce): Promise<void> {
    if (!annonce.id) return;
    this.actionEnCours = true;

    try {
      await this.annonceService.suspendreAnnonce(annonce.id);
      annonce.statut = 'suspendue';

      // Notification au propriétaire
      await this.notificationService.create({
        userId: annonce.proprietaireId,
        type: 'annonce',
        contenu: `Votre annonce « ${annonce.titre} » a été temporairement suspendue par un administrateur.`,
        lien: '/mes-annonces',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.avertissement("L'annonce a été suspendue.");
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de la suspension de l'annonce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Réactive une annonce suspendue
  async reactiver(annonce: Annonce): Promise<void> {
    if (!annonce.id) return;
    this.actionEnCours = true;

    try {
      await this.annonceService.validerAnnonce(annonce.id);
      annonce.statut = 'publiee';

      // Notification au propriétaire
      await this.notificationService.create({
        userId: annonce.proprietaireId,
        type: 'annonce',
        contenu: `Votre annonce « ${annonce.titre} » a été réactivée et est de nouveau visible en ligne.`,
        lien: '/mes-annonces',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.succes("L'annonce a été réactivée.");
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de la réactivation.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Affiche une photo en plein écran
  ouvrirZoom(photo: string): void {
    this.photoZoom = photo;
  }

  // Ferme la modale d'affichage de la photo
  fermerZoom(): void {
    this.photoZoom = null;
  }
}
