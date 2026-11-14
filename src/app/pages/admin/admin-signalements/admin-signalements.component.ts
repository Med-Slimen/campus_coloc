import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../../components/icon/icon.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { SignalementService } from '../../../services/signalement.service';
import { AnnonceService } from '../../../services/annonce.service';
import { NotificationService } from '../../../services/notification.service';
import { ToastService } from '../../../services/toast.service';
import { Signalement, Annonce, StatutSignalement } from '../../../models';

export interface SignalementEnrichi extends Signalement {
  annonce?: Annonce | null;
  titreAnnonce?: string;
  villeAnnonce?: string;
}

@Component({
  selector: 'app-admin-signalements',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './admin-signalements.component.html',
  styleUrls: ['./admin-signalements.component.css']
})
export class AdminSignalementsComponent implements OnInit {
  private signalementService = inject(SignalementService);
  private annonceService = inject(AnnonceService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // Liste enrichie des signalements
  signalements: SignalementEnrichi[] = [];

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  // Filtre d'affichage ('tous', 'ouvert', 'traite')
  filtreActif: 'tous' | StatutSignalement = 'tous';

  // Comptages
  get totalCount(): number {
    return this.signalements.length;
  }

  get ouvertsCount(): number {
    return this.signalements.filter(s => s.statut === 'ouvert').length;
  }

  get traitesCount(): number {
    return this.signalements.filter(s => s.statut === 'traite').length;
  }

  // Signalements filtrés selon l'onglet actif
  get signalementsFiltres(): SignalementEnrichi[] {
    if (this.filtreActif === 'tous') {
      return this.signalements;
    }
    return this.signalements.filter(s => s.statut === this.filtreActif);
  }

  async ngOnInit(): Promise<void> {
    await this.chargerSignalements();
  }

  // Charge les signalements réels et les annonces rattachées
  async chargerSignalements(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    try {
      const brut = await this.signalementService.getAllSignalements();

      // Récupération des annonces associées en parallèle
      const promesses = brut.map(async s => {
        let annonce: Annonce | null = null;
        try {
          if (s.annonceId) {
            annonce = await this.annonceService.getById(s.annonceId);
          }
        } catch {
          // Annonce possiblement supprimée
        }

        return {
          ...s,
          annonce,
          titreAnnonce: annonce?.titre || 'Logement inconnu ou supprimé',
          villeAnnonce: annonce?.ville || '-'
        };
      });

      this.signalements = await Promise.all(promesses);
    } catch (err: any) {
      this.erreur = err?.message || 'Erreur lors du chargement des signalements.';
    } finally {
      this.chargement = false;
    }
  }

  // Change l'onglet de filtrage
  changerFiltre(filtre: 'tous' | StatutSignalement): void {
    this.filtreActif = filtre;
  }

  // 1. Action : Voir l'annonce détaillée
  voirAnnonce(s: SignalementEnrichi): void {
    if (s.annonceId) {
      this.router.navigate(['/annonces', s.annonceId]);
    }
  }

  // 2. Action : Suspendre l'annonce signalée
  async suspendreAnnonce(s: SignalementEnrichi): Promise<void> {
    if (!s.annonceId) return;

    this.actionEnCours = true;
    try {
      await this.annonceService.suspendreAnnonce(s.annonceId);

      if (s.annonce) {
        s.annonce.statut = 'suspendue';

        // Notification au propriétaire
        await this.notificationService.create({
          userId: s.annonce.proprietaireId,
          type: 'annonce',
          contenu: `Votre annonce « ${s.annonce.titre} » a été suspendue suite à un signalement de modération.`,
          lien: '/mes-annonces',
          lue: false,
          dateEnvoi: new Date().toISOString()
        });
      }

      this.toastService.succes("L'annonce a été suspendue avec succès.");
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de la suspension de l'annonce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 3. Action : Marquer le signalement comme traité
  async marquerCommeTraite(s: SignalementEnrichi): Promise<void> {
    if (!s.id || s.statut === 'traite') return;

    this.actionEnCours = true;
    try {
      await this.signalementService.traiterSignalement(s.id);
      s.statut = 'traite';
      this.toastService.succes('Le signalement a été marqué comme traité.');
    } catch (err: any) {
      this.toastService.erreur(err?.message || 'Erreur lors du traitement du signalement.');
    } finally {
      this.actionEnCours = false;
    }
  }
}
