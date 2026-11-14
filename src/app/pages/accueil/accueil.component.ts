import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { AnnonceService } from '../../services/annonce.service';
import { Annonce, VILLES_TUNISIE } from '../../models';

@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IconComponent,
    StatusBadgeComponent,
    LoaderComponent,
    ErrorMessageComponent
  ],
  templateUrl: './accueil.component.html',
  styleUrls: ['./accueil.component.css']
})
export class AccueilComponent implements OnInit {
  private annonceService = inject(AnnonceService);
  private router = inject(Router);

  // Liste immuable des gouvernorats de Tunisie
  readonly villes = VILLES_TUNISIE;

  // Champs du bloc de recherche rapide
  villeRecherche: string = '';
  budgetMaxRecherche: number | null = null;

  // Liste des dernières annonces publiées
  annonces: Annonce[] = [];
  chargementAnnonces: boolean = false;
  erreurAnnonces: string | null = null;

  // Initialisation du composant et chargement des annonces récentes
  ngOnInit(): void {
    this.chargerDernieresAnnonces();
  }

  // Charge les 3 dernières annonces publiées depuis Firestore via le service
  async chargerDernieresAnnonces(): Promise<void> {
    this.chargementAnnonces = true;
    this.erreurAnnonces = null;

    try {
      this.annonces = await this.annonceService.getDernieresAnnonces(3);
    } catch {
      this.erreurAnnonces = 'Impossible de charger les dernières annonces pour le moment.';
    } finally {
      this.chargementAnnonces = false;
    }
  }

  // Redirige vers la page /annonces avec les critères de recherche en paramètres d'URL
  lancerRecherche(): void {
    const queryParams: Record<string, string | number> = {};

    if (this.villeRecherche.trim()) {
      queryParams['ville'] = this.villeRecherche.trim();
    }
    if (this.budgetMaxRecherche && this.budgetMaxRecherche > 0) {
      queryParams['budgetMax'] = this.budgetMaxRecherche;
    }

    this.router.navigate(['/annonces'], { queryParams });
  }
}
