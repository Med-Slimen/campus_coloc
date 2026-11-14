import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { AnnonceCardComponent } from '../../components/annonce-card/annonce-card.component';
import { AnnonceService } from '../../services/annonce.service';
import { EspaceService } from '../../services/espace.service';
import { Annonce, VILLES_TUNISIE } from '../../models';

@Component({
  selector: 'app-annonces',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IconComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AnnonceCardComponent
  ],
  templateUrl: './annonces.component.html',
  styleUrls: ['./annonces.component.css']
})
export class AnnoncesComponent implements OnInit {
  private annonceService = inject(AnnonceService);
  private espaceService = inject(EspaceService);
  private route = inject(ActivatedRoute);

  // Liste immuable des gouvernorats de Tunisie
  readonly villes = VILLES_TUNISIE;

  // Options strictes de durée de location
  readonly optionsDuree = [
    'Toutes les durées',
    '1 semestre',
    '1 année universitaire',
    '1 à 3 mois',
    'Flexible'
  ];

  // Options de tri
  readonly optionsTri = [
    { label: 'Plus récentes', valeur: 'recent' },
    { label: 'Prix croissant', valeur: 'prix_asc' },
    { label: 'Prix décroissant', valeur: 'prix_desc' }
  ];

  // Données Firestore
  toutesAnnonces: Annonce[] = [];
  espacesPublicsOuverts = new Set<string>();

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  panneauFiltresMobileOuvert: boolean = false;

  // Filtres actifs
  ville: string = '';
  quartier: string = '';
  budgetMax: number | null = null;
  minimumPlaces: number | null = null;
  meuble: 'peu_importe' | 'oui' | 'non' = 'peu_importe';
  duree: string = 'Toutes les durées';
  tri: 'recent' | 'prix_asc' | 'prix_desc' = 'recent';

  async ngOnInit(): Promise<void> {
    // Lecture des paramètres de recherche transmis depuis la page d'accueil
    this.route.queryParams.subscribe(params => {
      if (params['ville']) {
        this.ville = params['ville'];
      }
      if (params['budgetMax']) {
        const b = Number(params['budgetMax']);
        if (!isNaN(b) && b > 0) {
          this.budgetMax = b;
        }
      }
    });

    await this.chargerDonnees();
  }

  // Charge une unique fois les annonces publiées et les espaces publics ouverts
  async chargerDonnees(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    try {
      const [annonces, espacesIds] = await Promise.all([
        this.annonceService.getPubliees(),
        this.espaceService.getEspacesPublicsOuvertsIds()
      ]);

      this.toutesAnnonces = annonces;
      this.espacesPublicsOuverts = new Set(espacesIds);
    } catch {
      this.erreur = 'Impossible de charger les offres de colocation pour le moment.';
    } finally {
      this.chargement = false;
    }
  }

  // Calcule la liste filtrée et triée côté composant sans requêtes Firestore supplémentaires
  get annoncesFiltrees(): Annonce[] {
    let resultats = [...this.toutesAnnonces];

    // Filtre par ville (gouvernorat exact)
    if (this.ville) {
      resultats = resultats.filter(a => a.ville === this.ville);
    }

    // Filtre par quartier (recherche textuelle insensible à la casse)
    if (this.quartier.trim()) {
      const q = this.quartier.trim().toLowerCase();
      resultats = resultats.filter(a => (a.quartier || '').toLowerCase().includes(q));
    }

    // Filtre par budget maximum par personne (calcul : (loyer + charges) / places)
    if (this.budgetMax && this.budgetMax > 0) {
      resultats = resultats.filter(a => {
        const budget = Math.round(
          ((a.loyer || 0) + (a.charges || 0)) / Math.max(1, a.nombrePlaces || 1)
        );
        return budget <= this.budgetMax!;
      });
    }

    // Filtre par nombre minimum de places
    if (this.minimumPlaces && this.minimumPlaces > 0) {
      resultats = resultats.filter(a => (a.nombrePlaces || 1) >= this.minimumPlaces!);
    }

    // Filtre ameublement
    if (this.meuble === 'oui') {
      resultats = resultats.filter(a => a.meuble === true);
    } else if (this.meuble === 'non') {
      resultats = resultats.filter(a => a.meuble === false);
    }

    // Filtre durée de location
    if (this.duree && this.duree !== 'Toutes les durées') {
      resultats = resultats.filter(a => a.dureeLocation === this.duree);
    }

    // Tri des résultats
    if (this.tri === 'prix_asc') {
      resultats.sort((a, b) => {
        const bA = Math.round(((a.loyer || 0) + (a.charges || 0)) / Math.max(1, a.nombrePlaces || 1));
        const bB = Math.round(((b.loyer || 0) + (b.charges || 0)) / Math.max(1, b.nombrePlaces || 1));
        return bA - bB;
      });
    } else if (this.tri === 'prix_desc') {
      resultats.sort((a, b) => {
        const bA = Math.round(((a.loyer || 0) + (a.charges || 0)) / Math.max(1, a.nombrePlaces || 1));
        const bB = Math.round(((b.loyer || 0) + (b.charges || 0)) / Math.max(1, b.nombrePlaces || 1));
        return bB - bA;
      });
    } else {
      // Tri par plus récente en premier
      resultats.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
    }

    return resultats;
  }

  // Vérifie si des filtres personnalisés sont actifs
  get aFiltresActifs(): boolean {
    return !!(
      this.ville ||
      this.quartier.trim() ||
      (this.budgetMax && this.budgetMax > 0) ||
      (this.minimumPlaces && this.minimumPlaces > 0) ||
      this.meuble !== 'peu_importe' ||
      this.duree !== 'Toutes les durées'
    );
  }

  // Réinitialise l'ensemble des filtres à leurs valeurs par défaut
  reinitialiserFiltres(): void {
    this.ville = '';
    this.quartier = '';
    this.budgetMax = null;
    this.minimumPlaces = null;
    this.meuble = 'peu_importe';
    this.duree = 'Toutes les durées';
    this.tri = 'recent';
  }

  // Bascule la visibilité du panneau de filtres sur écran mobile
  toggleFiltresMobile(): void {
    this.panneauFiltresMobileOuvert = !this.panneauFiltresMobileOuvert;
  }

  // Détermine si une annonce possède un espace public ouvert
  aEspaceOuvert(annonceId?: string): boolean {
    return !!annonceId && this.espacesPublicsOuverts.has(annonceId);
  }
}
