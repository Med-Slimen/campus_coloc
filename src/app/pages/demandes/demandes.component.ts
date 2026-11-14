import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { DemandeService } from '../../services/demande.service';
import { AnnonceService } from '../../services/annonce.service';
import { EspaceService } from '../../services/espace.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { Demande, User } from '../../models';

export interface DemandeEtudiantItem {
  demande: Demande;
  annonceTitre: string;
  annonceVille?: string;
}

export interface DemandeProprietaireItem {
  demande: Demande;
  annonceTitre: string;
  etudiant: User | null;
}

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    AvatarComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './demandes.component.html',
  styleUrls: ['./demandes.component.css']
})
export class DemandesComponent implements OnInit {
  private demandeService = inject(DemandeService);
  private annonceService = inject(AnnonceService);
  private espaceService = inject(EspaceService);
  private userService = inject(UserService);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // Données pour les étudiants
  demandesEtudiant: DemandeEtudiantItem[] = [];

  // Données pour les propriétaires
  demandesProprietaire: DemandeProprietaireItem[] = [];

  // Identifiants des annonces ayant un espace de colocation actif (non fermé)
  espacesActifsIds: Set<string> = new Set();

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  // Détermine si l'utilisateur est propriétaire ou étudiant
  get estProprietaire(): boolean {
    return this.authService.currentUser?.role === 'proprietaire';
  }

  get estEtudiant(): boolean {
    return this.authService.currentUser?.role === 'etudiant';
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerDemandes();
  }

  // Charge les demandes adaptées au rôle de l'utilisateur connecté
  async chargerDemandes(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.chargement = false;
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      if (this.estProprietaire) {
        // Chargement pour bailleur : demandes reçues pour ses annonces
        const liste = await this.demandeService.getDemandesByProprietaire(user.uid);
        const promesses = liste.map(async (d): Promise<DemandeProprietaireItem> => {
          const [annonce, etudiant] = await Promise.all([
            this.annonceService.getById(d.annonceId).catch(() => null),
            this.userService.getUser(d.etudiantId).catch(() => null)
          ]);

          return {
            demande: d,
            annonceTitre: annonce?.titre || 'Logement indisponible',
            etudiant
          };
        });

        this.demandesProprietaire = await Promise.all(promesses);
      } else {
        // Chargement pour étudiant : demandes envoyées
        const liste = await this.demandeService.getDemandesByEtudiant(user.uid);
        const promesses = liste.map(async (d): Promise<DemandeEtudiantItem> => {
          const annonce = await this.annonceService.getById(d.annonceId).catch(() => null);
          return {
            demande: d,
            annonceTitre: annonce?.titre || 'Logement indisponible',
            annonceVille: annonce?.ville
          };
        });

        this.demandesEtudiant = await Promise.all(promesses);
      }

      // Vérifier précisément quels logements possèdent un espace ACTIF (non fermé)
      const idsAnnoncesAcceptees = new Set<string>();
      if (this.estProprietaire) {
        this.demandesProprietaire
          .filter(i => i.demande.statut === 'acceptee')
          .forEach(i => idsAnnoncesAcceptees.add(i.demande.annonceId));
      } else {
        this.demandesEtudiant
          .filter(i => i.demande.statut === 'acceptee')
          .forEach(i => idsAnnoncesAcceptees.add(i.demande.annonceId));
      }

      const checksEspaces = Array.from(idsAnnoncesAcceptees).map(async id => {
        const esp = await this.espaceService.getEspaceActif(id).catch(() => null);
        return { id, actif: !!esp };
      });
      const resultats = await Promise.all(checksEspaces);
      this.espacesActifsIds = new Set(resultats.filter(r => r.actif).map(r => r.id));
    } catch {
      this.erreur = 'Impossible de récupérer la liste des demandes pour le moment.';
    } finally {
      this.chargement = false;
    }
  }

  // Vérifie si une annonce a un espace de colocation actif (non fermé)
  aEspaceActif(annonceId: string): boolean {
    return this.espacesActifsIds.has(annonceId);
  }

  // 1. Action Étudiant : Annuler une demande en attente
  async annulerDemande(item: DemandeEtudiantItem): Promise<void> {
    const d = item.demande;
    if (!d.id || d.statut !== 'en_attente') return;

    this.actionEnCours = true;
    try {
      await this.demandeService.annulerDemande(d.id);
      d.statut = 'annulee';

      // Notification au propriétaire
      const user = this.authService.currentUser;
      await this.notificationService.create({
        userId: d.proprietaireId,
        type: 'demande',
        contenu: `L'étudiant ${user?.nom || 'Un candidat'} a annulé sa demande pour l'annonce « ${item.annonceTitre} ».`,
        lien: '/demandes',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.succes('Votre demande a bien été annulée.');
    } catch {
      this.toastService.erreur('Une erreur est survenue lors de l’annulation de la demande.');
    } finally {
      this.actionEnCours = false;
    }
  }

  // 2. Action Propriétaire : Accepter une demande d'un étudiant (crée l'espace et le 1er membre via writeBatch)
  async accepterDemande(item: DemandeProprietaireItem): Promise<void> {
    const d = item.demande;
    if (!d.id || d.statut !== 'en_attente') return;

    this.actionEnCours = true;
    try {
      await this.espaceService.creerEspaceDepuisDemande(d, item.annonceTitre);
      d.statut = 'acceptee';
      this.espacesActifsIds.add(d.annonceId);
      this.toastService.succes(
        `La candidature de ${item.etudiant?.nom || 'l\'étudiant'} a été acceptée et l'espace de colocation a été ouvert !`
      );
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'acceptation de la demande.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 3. Action Propriétaire : Refuser une demande d'un étudiant
  async refuserDemande(item: DemandeProprietaireItem): Promise<void> {
    const d = item.demande;
    if (!d.id || d.statut !== 'en_attente') return;

    this.actionEnCours = true;
    try {
      await this.demandeService.refuserDemande(d.id);
      d.statut = 'refusee';

      // Notification à l'étudiant
      await this.notificationService.create({
        userId: d.etudiantId,
        type: 'demande',
        contenu: `Votre demande pour « ${item.annonceTitre} » a été refusée par le propriétaire.`,
        lien: '/demandes',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.avertissement('La candidature a été refusée.');
    } catch {
      this.toastService.erreur('Erreur lors du refus de la demande.');
    } finally {
      this.actionEnCours = false;
    }
  }

  // Navigation vers la liste des logements
  naviguerVersAnnonces(): void {
    this.router.navigate(['/annonces']);
  }
}
