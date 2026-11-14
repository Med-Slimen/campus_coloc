import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { EspaceService } from '../../services/espace.service';
import { ToastService } from '../../services/toast.service';
import { Notification } from '../../models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private espaceService = inject(EspaceService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // Liste complète des notifications
  notifications: Notification[] = [];

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  // Filtre d'affichage ('toutes' ou 'non_lues')
  filtreActif: 'toutes' | 'non_lues' = 'toutes';

  // Nombre de notifications non consultées
  get nbNonLues(): number {
    return this.notifications.filter(n => !n.lue).length;
  }

  // Liste filtrée selon le critère sélectionné
  get notificationsFiltrees(): Notification[] {
    if (this.filtreActif === 'non_lues') {
      return this.notifications.filter(n => !n.lue);
    }
    return this.notifications;
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    await this.chargerNotifications();
  }

  // Charge l'intégralité des notifications de l'utilisateur
  async chargerNotifications(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.chargement = false;
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      this.notifications = await this.notificationService.getMine(user.uid);
    } catch (err: any) {
      this.erreur = err?.message || 'Impossible de récupérer vos notifications pour le moment.';
    } finally {
      this.chargement = false;
    }
  }

  // Change l'onglet de filtrage actif
  changerFiltre(filtre: 'toutes' | 'non_lues'): void {
    this.filtreActif = filtre;
  }

  // Marque une notification spécifique comme consultée
  async marquerCommeLue(notif: Notification, event?: MouseEvent): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!notif.id || notif.lue) return;

    try {
      await this.notificationService.markAsRead(notif.id);
      notif.lue = true;
    } catch {
      this.toastService.erreur("Impossible de marquer la notification comme lue.");
    }
  }

  // Marque toutes les notifications non lues comme lues
  async marquerToutCommeLu(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid || this.nbNonLues === 0) return;

    this.actionEnCours = true;
    try {
      await this.notificationService.markAllAsRead(user.uid);
      this.notifications.forEach(n => (n.lue = true));
      this.toastService.succes("Toutes vos notifications sont désormais marquées comme lues.");
    } catch {
      this.toastService.erreur("Erreur lors de la mise à jour des notifications.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Clic sur une notification : marque comme lue et redirige vers la cible
  async cliquerNotification(notif: Notification): Promise<void> {
    if (notif.id && !notif.lue) {
      try {
        await this.notificationService.markAsRead(notif.id);
        notif.lue = true;
      } catch {
        // Silencieux
      }
    }

    if (notif.lien) {
      this.router.navigateByUrl(notif.lien);
    }
  }

  // Répondre à une invitation d'espace de colocation (Règle 6)
  async repondreInvitation(
    notif: Notification,
    decision: 'accepte' | 'refuse',
    event: MouseEvent
  ): Promise<void> {
    event.stopPropagation();
    const user = this.authService.currentUser;
    if (!user || !user.uid || !notif.annonceId) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.answerMembre(notif.annonceId, user.uid, decision);
      if (notif.id) {
        await this.notificationService.markAsRead(notif.id);
        notif.lue = true;
      }

      if (decision === 'accepte') {
        this.toastService.succes("Invitation acceptée ! Bienvenue dans votre nouvelle colocation.");
        this.router.navigate(['/espace', notif.annonceId]);
      } else {
        this.toastService.info("L'invitation a été refusée.");
      }
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du traitement de l'invitation.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Renvoie le nom de l'icône selon le type
  getIcone(type: string): string {
    switch (type) {
      case 'verification':
        return 'shield-check';
      case 'annonce':
        return 'home';
      case 'demande':
        return 'file';
      case 'invitation_espace':
      case 'demande_espace':
      case 'adhesion_acceptee':
      case 'adhesion_refusee':
        return 'users';
      default:
        return 'bell';
    }
  }

  // Renvoie l'étiquette textuelle selon le type
  getBadgeLabel(type: string): string {
    switch (type) {
      case 'verification':
        return 'VÉRIFICATION';
      case 'annonce':
        return 'ANNONCE';
      case 'demande':
        return 'DEMANDE';
      case 'invitation_espace':
        return 'INVITATION';
      case 'demande_espace':
        return 'ADHÉSION';
      case 'adhesion_acceptee':
        return 'COLOCATION';
      case 'adhesion_refusee':
        return 'COLOCATION';
      default:
        return 'NOTIFICATION';
    }
  }

  // Navigation vers la page d'accueil
  naviguerVersAccueil(): void {
    this.router.navigate(['/']);
  }
}

