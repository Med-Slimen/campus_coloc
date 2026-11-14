import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { AnnonceCardComponent } from '../../components/annonce-card/annonce-card.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { AuthService } from '../../services/auth.service';
import { AnnonceService } from '../../services/annonce.service';
import { DemandeService } from '../../services/demande.service';
import { EspaceService } from '../../services/espace.service';
import { Annonce, StatutVerification, VILLES_TUNISIE, Espace } from '../../models';

export interface ColocationItemEtudiant {
  espace: Espace;
  annonce: Annonce | null;
}

@Component({
  selector: 'app-dashboard-etudiant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    AnnonceCardComponent,
    LoaderComponent,
    ErrorMessageComponent
  ],
  templateUrl: './dashboard-etudiant.component.html',
  styleUrls: ['./dashboard-etudiant.component.css']
})
export class DashboardEtudiantComponent implements OnInit {
  public authService = inject(AuthService);
  private annonceService = inject(AnnonceService);
  private demandeService = inject(DemandeService);
  private espaceService = inject(EspaceService);
  private router = inject(Router);

  // Constante des gouvernorats
  readonly villes = VILLES_TUNISIE;

  // États du chargement
  chargement: boolean = true;
  erreur: string | null = null;

  // Données statistiques
  nbFavoris: number = 0;
  nbDemandes: number = 0;
  nbColocations: number = 0;
  colocations: Espace[] = [];
  colocationsAvecAnnonce: ColocationItemEtudiant[] = [];

  // Annonces affichées
  derniersFavoris: Annonce[] = [];
  dernieresAnnonces: Annonce[] = [];
  espacesPublicsOuverts = new Set<string>();

  // Champs de la recherche rapide
  rechercheVille: string = '';
  rechercheBudgetMax: number | null = null;

  // Prénom de l'étudiant
  get prenom(): string {
    const nom = this.authService.currentUser?.nom || '';
    return nom.trim().split(' ')[0] || 'Étudiant';
  }

  // Statut de vérification de l'étudiant
  get statutVerification(): StatutVerification {
    return this.authService.currentUser?.statutVerification || 'non_verifie';
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerDonnees();
  }

  // Charge toutes les données réelles du tableau de bord étudiant
  async chargerDonnees(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.chargement = false;
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      // 1. Récupération des espaces publics ouverts (pour les badges des cartes)
      const publicsOuvertsIds = await this.espaceService.getEspacesPublicsOuvertsIds();
      this.espacesPublicsOuverts = new Set(publicsOuvertsIds);

      // 2. Récupération des demandes et des colocations de l'étudiant
      const [demandes, colocs, dernieres] = await Promise.all([
        this.demandeService.getByEtudiant(user.uid),
        this.espaceService.getEspacesByEtudiant(user.uid),
        this.annonceService.getDernieresAnnonces(3)
      ]);

      this.nbDemandes = demandes.length;
      this.colocations = colocs;
      this.nbColocations = colocs.length;
      this.dernieresAnnonces = dernieres;

      // Associer chaque colocation à son annonce pour un affichage enrichi
      if (colocs.length > 0) {
        const promessesAnnonces = colocs.map(c =>
          this.annonceService.getById(c.annonceId || c.id || '').catch(() => null)
        );
        const annoncesColocs = await Promise.all(promessesAnnonces);
        this.colocationsAvecAnnonce = colocs.map((c, idx) => ({
          espace: c,
          annonce: annoncesColocs[idx]
        }));
      } else {
        this.colocationsAvecAnnonce = [];
      }

      // 3. Récupération des 3 derniers favoris
      const favorisIds = user.favoris || [];
      this.nbFavoris = favorisIds.length;

      if (favorisIds.length > 0) {
        const derniersIds = favorisIds.slice(-3).reverse();
        const promessesFavoris = derniersIds.map(id => this.annonceService.getById(id));
        const resultatsFavoris = await Promise.all(promessesFavoris);
        this.derniersFavoris = resultatsFavoris.filter(
          (a): a is Annonce => a !== null && a.statut === 'publiee'
        );
      } else {
        this.derniersFavoris = [];
      }
    } catch (err: any) {
      this.erreur = err?.message || 'Erreur lors du chargement de votre tableau de bord.';
    } finally {
      this.chargement = false;
    }
  }

  // Vérifie si une annonce a une colocation ouverte
  aEspaceOuvert(annonceId?: string): boolean {
    return !!annonceId && this.espacesPublicsOuverts.has(annonceId);
  }

  // Exécute la recherche rapide et redirige vers la liste des annonces avec filtres
  executerRechercheRapide(): void {
    const queryParams: any = {};
    if (this.rechercheVille) {
      queryParams.ville = this.rechercheVille;
    }
    if (this.rechercheBudgetMax && this.rechercheBudgetMax > 0) {
      queryParams.budgetMax = this.rechercheBudgetMax;
    }
    this.router.navigate(['/annonces'], { queryParams });
  }
}
