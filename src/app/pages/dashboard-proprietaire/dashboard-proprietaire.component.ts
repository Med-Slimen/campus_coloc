import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { AuthService } from '../../services/auth.service';
import { AnnonceService } from '../../services/annonce.service';
import { DemandeService } from '../../services/demande.service';
import { Annonce, Demande, StatutVerification } from '../../models';

@Component({
  selector: 'app-dashboard-proprietaire',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    LoaderComponent,
    ErrorMessageComponent
  ],
  templateUrl: './dashboard-proprietaire.component.html',
  styleUrls: ['./dashboard-proprietaire.component.css']
})
export class DashboardProprietaireComponent implements OnInit {
  public authService = inject(AuthService);
  private annonceService = inject(AnnonceService);
  private demandeService = inject(DemandeService);
  private router = inject(Router);

  // Données des annonces du bailleur
  annonces: Annonce[] = [];
  demandesRecues: Demande[] = [];

  // États du chargement
  chargement: boolean = true;
  erreur: string | null = null;

  // Prénom du propriétaire
  get prenom(): string {
    const nom = this.authService.currentUser?.nom || '';
    return nom.trim().split(' ')[0] || 'Propriétaire';
  }

  // Statut de vérification
  get statutVerification(): StatutVerification {
    return this.authService.currentUser?.statutVerification || 'non_verifie';
  }

  // Indique si le bailleur est autorisé à publier
  get estVerifie(): boolean {
    return this.statutVerification === 'verifie';
  }

  // Statistiques calculées
  get totalAnnonces(): number {
    return this.annonces.length;
  }

  get nbPubliees(): number {
    return this.annonces.filter(a => a.statut === 'publiee').length;
  }

  get nbEnAttente(): number {
    return this.annonces.filter(a => a.statut === 'en_attente').length;
  }

  get nbSuspenduesOuRefusees(): number {
    return this.annonces.filter(a => a.statut === 'suspendue' || a.statut === 'refusee').length;
  }

  get nbDemandesEnAttente(): number {
    return this.demandesRecues.filter(d => d.statut === 'en_attente').length;
  }

  // Les 5 dernières annonces pour le tableau
  get cinqDernieresAnnonces(): Annonce[] {
    return this.annonces.slice(0, 5);
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerDonnees();
  }

  // Charge les annonces et les demandes reçues pour le propriétaire connecté
  async chargerDonnees(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.chargement = false;
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      const [annonces, demandes] = await Promise.all([
        this.annonceService.getByProprietaire(user.uid),
        this.demandeService.getByProprietaire(user.uid)
      ]);

      this.annonces = annonces;
      this.demandesRecues = demandes;
    } catch (err: any) {
      this.erreur = err?.message || 'Erreur lors du chargement de votre tableau de bord.';
    } finally {
      this.chargement = false;
    }
  }

  // Navigation vers la création d'annonce si le bailleur est vérifié
  naviguerNouvelleAnnonce(): void {
    if (this.estVerifie) {
      this.router.navigate(['/mes-annonces/nouvelle']);
    }
  }
}
