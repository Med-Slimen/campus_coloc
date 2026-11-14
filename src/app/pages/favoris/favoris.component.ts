import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { AnnonceCardComponent } from '../../components/annonce-card/annonce-card.component';
import { AuthService } from '../../services/auth.service';
import { AnnonceService } from '../../services/annonce.service';
import { EspaceService } from '../../services/espace.service';
import { ToastService } from '../../services/toast.service';
import { Annonce } from '../../models';

interface ElementFavori {
  id: string;
  annonce: Annonce | null;
  estPubliee: boolean;
  motifIndisponibilite?: string;
}

@Component({
  selector: 'app-favoris',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AnnonceCardComponent
  ],
  templateUrl: './favoris.component.html',
  styleUrls: ['./favoris.component.css']
})
export class FavorisComponent implements OnInit {
  public authService = inject(AuthService);
  private annonceService = inject(AnnonceService);
  private espaceService = inject(EspaceService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // Liste des annonces enregistrées en favoris avec métadonnées de disponibilité
  elementsFavoris: ElementFavori[] = [];
  espacesPublicsOuverts = new Set<string>();

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerFavoris();
  }

  // Charge les données détaillées de chaque annonce présente dans favoris
  async chargerFavoris(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    const ids = this.authService.currentUser?.favoris || [];

    if (ids.length === 0) {
      this.elementsFavoris = [];
      this.chargement = false;
      return;
    }

    try {
      const [annoncesResultats, espacesIds] = await Promise.all([
        Promise.all(
          ids.map(async (id): Promise<ElementFavori> => {
            try {
              const a = await this.annonceService.getById(id);
              if (!a) {
                return {
                  id,
                  annonce: null,
                  estPubliee: false,
                  motifIndisponibilite: 'Ce logement a été supprimé par son propriétaire.'
                };
              }

              const estPubliee = a.statut === 'publiee';
              let motif: string | undefined;

              if (!estPubliee) {
                if (a.statut === 'suspendue') {
                  motif = "Ce logement n'est plus disponible (suspendu par le propriétaire).";
                } else if (a.statut === 'en_attente') {
                  motif = 'Cette annonce est actuellement en cours de vérification.';
                } else {
                  motif = 'Cette annonce n’est plus publiée.';
                }
              }

              return {
                id,
                annonce: a,
                estPubliee,
                motifIndisponibilite: motif
              };
            } catch {
              return {
                id,
                annonce: null,
                estPubliee: false,
                motifIndisponibilite: 'Impossible de charger ce logement.'
              };
            }
          })
        ),
        this.espaceService.getEspacesPublicsOuvertsIds()
      ]);

      this.elementsFavoris = annoncesResultats;
      this.espacesPublicsOuverts = new Set(espacesIds);
    } catch {
      this.erreur = 'Impossible de récupérer vos annonces favorites pour le moment.';
    } finally {
      this.chargement = false;
    }
  }

  // Retire une annonce du tableau des favoris du profil utilisateur
  async retirerFavori(id: string): Promise<void> {
    this.actionEnCours = true;
    try {
      await this.authService.retirerFavori(id);
      this.elementsFavoris = this.elementsFavoris.filter(item => item.id !== id);
      this.toastService.succes('Logement retiré de vos favoris.');
    } catch {
      this.toastService.erreur('Impossible de retirer ce logement des favoris.');
    } finally {
      this.actionEnCours = false;
    }
  }

  // Vérifie si un espace public ouvert est disponible
  aEspaceOuvert(id?: string): boolean {
    return !!id && this.espacesPublicsOuverts.has(id);
  }

  // Redirige vers la recherche de logements
  naviguerVersAnnonces(): void {
    this.router.navigate(['/annonces']);
  }
}
