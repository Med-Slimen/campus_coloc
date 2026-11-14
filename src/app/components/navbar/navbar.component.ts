import { Component, Input, OnInit, OnDestroy, inject, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { EspaceService } from '../../services/espace.service';
import { ToastService } from '../../services/toast.service';
import { RoleUtilisateur, Notification } from '../../models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private espaceService = inject(EspaceService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private cdRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Rôle forcé en entrée (ex. prévisualisation)
  @Input() mode?: RoleUtilisateur | 'visiteur';

  // État du tiroir responsive mobile
  menuMobileOuvert: boolean = false;

  // État du menu déroulant utilisateur
  menuUtilisateurOuvert: boolean = false;

  // État du panneau des notifications
  menuNotificationsOuvert: boolean = false;
  notifications: Notification[] = [];
  nbNonLues: number = 0;
  chargementNotifications: boolean = false;
  actionNotifEnCours: boolean = false;

  // Identifiant de l'espace de colocation actif de l'utilisateur (s'il en a un)
  espaceActifId: string | null = null;

  // Référence de désinscription onSnapshot & router
  private unsubscribeNotifs?: () => void;
  private routerSubscription?: Subscription;

  // Détermine la variante active de la barre de navigation
  get roleActif(): 'visiteur' | RoleUtilisateur {
    if (this.mode) {
      return this.mode;
    }
    return this.authService.currentUser?.role || 'visiteur';
  }

  // Nom affiché pour l'utilisateur
  get nomUtilisateur(): string {
    return this.authService.currentUser?.nom || 'Utilisateur';
  }

  // Renvoie au maximum les 10 dernières notifications pour le panneau déroulant
  get dixDernieresNotifications(): Notification[] {
    return this.notifications.slice(0, 10);
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    this.initialiserEcouteNotifications();
    await this.chargerEspaceActif();
    this.cdRef.markForCheck();

    // Écoute les événements de navigation pour synchroniser la barre et fermer les menus
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.fermerMenus();
        this.chargerEspaceActif();
        this.cdRef.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.arreterEcouteNotifications();
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  // Charge l'espace actif de l'utilisateur connecté s'il existe
  async chargerEspaceActif(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.espaceActifId = null;
      return;
    }

    try {
      if (user.role === 'proprietaire') {
        const espaces = await this.espaceService.getEspacesByProprietaire(user.uid);
        this.espaceActifId = espaces.length > 0 ? (espaces[0].id || espaces[0].annonceId || null) : null;
      } else if (user.role === 'etudiant') {
        const espaces = await this.espaceService.getEspacesByEtudiant(user.uid);
        this.espaceActifId = espaces.length > 0 ? (espaces[0].id || espaces[0].annonceId || null) : null;
      } else {
        this.espaceActifId = null;
      }
    } catch {
      this.espaceActifId = null;
    }
    this.cdRef.markForCheck();
  }

  // Ferme les menus lors d'un clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const cible = event.target as HTMLElement;
    if (!cible.closest('.menu-utilisateur-conteneur')) {
      this.menuUtilisateurOuvert = false;
    }
    if (!cible.closest('.menu-notifications-conteneur')) {
      this.menuNotificationsOuvert = false;
    }
  }

  // Initialise l'écoute onSnapshot des notifications non lues
  initialiserEcouteNotifications(): void {
    this.arreterEcouteNotifications();

    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.unsubscribeNotifs = this.notificationService.listenUnread(
      user.uid,
      (unread, count) => {
        this.nbNonLues = count;
        // Si le panneau est ouvert, rafraîchir la liste complète
        if (this.menuNotificationsOuvert) {
          this.chargerNotifications();
        }
      }
    );

    // Chargement initial des notifications
    this.chargerNotifications();
  }

  // Arrête le listener onSnapshot
  arreterEcouteNotifications(): void {
    if (this.unsubscribeNotifs) {
      this.unsubscribeNotifs();
      this.unsubscribeNotifs = undefined;
    }
  }

  // Bascule le menu déroulant utilisateur
  basculerMenuUtilisateur(event: MouseEvent): void {
    event.stopPropagation();
    this.menuUtilisateurOuvert = !this.menuUtilisateurOuvert;
    this.menuNotificationsOuvert = false;
  }

  // Bascule le panneau des notifications et charge les notifications
  async basculerMenuNotifications(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.menuNotificationsOuvert = !this.menuNotificationsOuvert;
    this.menuUtilisateurOuvert = false;

    if (this.menuNotificationsOuvert) {
      if (!this.unsubscribeNotifs && this.authService.currentUser?.uid) {
        this.initialiserEcouteNotifications();
      }
      await this.chargerNotifications();
    }
  }

  // Charge les notifications de l'utilisateur connecté
  async chargerNotifications(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.chargementNotifications = true;
    try {
      this.notifications = await this.notificationService.getMine(user.uid);
      this.nbNonLues = this.notifications.filter(n => !n.lue).length;
    } catch {
      // Ignorer silencieusement en navigation
    } finally {
      this.chargementNotifications = false;
    }
  }

  // Marque toutes les notifications comme lues
  async marquerToutCommeLu(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    try {
      await this.notificationService.markAllAsRead(user.uid);
      this.notifications.forEach(n => (n.lue = true));
      this.nbNonLues = 0;
      this.toastService.succes('Toutes les notifications ont été marquées comme lues.');
    } catch {
      this.toastService.erreur('Erreur lors de la mise à jour des notifications.');
    }
  }

  // Répondre à une invitation d'espace directement depuis la notification (Règle 6)
  async repondreInvitationNotif(
    notif: Notification,
    decision: 'accepte' | 'refuse'
  ): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid || !notif.annonceId) return;

    this.actionNotifEnCours = true;
    try {
      await this.espaceService.answerMembre(notif.annonceId, user.uid, decision);
      if (notif.id) {
        await this.notificationService.markAsRead(notif.id);
        notif.lue = true;
        if (this.nbNonLues > 0) this.nbNonLues--;
      }

      if (decision === 'accepte') {
        this.toastService.succes("Invitation acceptée ! Bienvenue dans votre nouvelle colocation.");
        this.fermerMenus();
        this.router.navigate(['/espace', notif.annonceId]);
      } else {
        this.toastService.info("Invitation refusée.");
      }
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de traiter l'invitation.");
    } finally {
      this.actionNotifEnCours = false;
    }
  }

  // Marque une notification classique comme lue et redirige vers son lien
  async cliquerNotification(notif: Notification): Promise<void> {
    if (notif.id && !notif.lue) {
      try {
        await this.notificationService.markAsRead(notif.id);
        notif.lue = true;
        if (this.nbNonLues > 0) this.nbNonLues--;
      } catch {
        // Silencieux
      }
    }
    this.fermerMenus();
    if (notif.lien) {
      this.router.navigateByUrl(notif.lien);
    }
  }

  // Renvoie le nom de l'icône selon le type de notification
  getIconeNotif(type: string): string {
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

  // Bascule le menu burger sur petits écrans
  basculerMenuMobile(): void {
    this.menuMobileOuvert = !this.menuMobileOuvert;
    this.menuUtilisateurOuvert = false;
    this.menuNotificationsOuvert = false;
  }

  // Ferme tous les tiroirs et menus ouverts
  fermerMenus(): void {
    this.menuMobileOuvert = false;
    this.menuUtilisateurOuvert = false;
    this.menuNotificationsOuvert = false;
  }

  // Déconnecte l'utilisateur et le redirige vers l'accueil ou la connexion
  async seDeconnecter(): Promise<void> {
    this.fermerMenus();
    this.arreterEcouteNotifications();
    this.notifications = [];
    this.nbNonLues = 0;
    try {
      await this.authService.logout();
      this.toastService.info('Vous êtes maintenant déconnecté.');
      this.router.navigate(['/connexion']);
    } catch {
      this.toastService.erreur('Erreur lors de la déconnexion.');
    }
  }
}
