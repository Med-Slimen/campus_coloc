import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from '../../../components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../../components/error-message/error-message.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { UserService } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { ToastService } from '../../../services/toast.service';
import { User, StatutVerification, RoleUtilisateur } from '../../../models';

@Component({
  selector: 'app-admin-utilisateurs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarComponent,
    StatusBadgeComponent,
    IconComponent,
    LoaderComponent,
    ErrorMessageComponent,
    EmptyStateComponent
  ],
  templateUrl: './admin-utilisateurs.component.html',
  styleUrls: ['./admin-utilisateurs.component.css']
})
export class AdminUtilisateursComponent implements OnInit {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);

  // Liste de tous les utilisateurs
  utilisateurs: User[] = [];

  // États du composant
  chargement: boolean = true;
  erreur: string | null = null;
  actionEnCours: boolean = false;

  // Filtres
  recherche: string = '';
  filtreRole: 'tous' | RoleUtilisateur = 'tous';

  // Comptages
  get totalCount(): number {
    return this.utilisateurs.length;
  }

  get etudiantCount(): number {
    return this.utilisateurs.filter(u => u.role === 'etudiant').length;
  }

  get proprietaireCount(): number {
    return this.utilisateurs.filter(u => u.role === 'proprietaire').length;
  }

  get adminCount(): number {
    return this.utilisateurs.filter(u => u.role === 'admin').length;
  }

  // Utilisateurs filtrés par recherche textuelle (nom ou courriel) et par rôle
  get utilisateursFiltres(): User[] {
    const terme = this.recherche.trim().toLowerCase();

    return this.utilisateurs.filter(u => {
      // 1. Filtre par rôle
      if (this.filtreRole !== 'tous' && u.role !== this.filtreRole) {
        return false;
      }

      // 2. Filtre de recherche par nom ou email
      if (terme) {
        const nomOk = (u.nom || '').toLowerCase().includes(terme);
        const emailOk = (u.email || '').toLowerCase().includes(terme);
        return nomOk || emailOk;
      }

      return true;
    });
  }

  async ngOnInit(): Promise<void> {
    await this.chargerUtilisateurs();
  }

  // Charge les utilisateurs réels depuis Firestore
  async chargerUtilisateurs(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    try {
      this.utilisateurs = await this.userService.getAllUsers();
    } catch (err: any) {
      this.erreur = err?.message || 'Erreur lors du chargement des utilisateurs.';
    } finally {
      this.chargement = false;
    }
  }

  // Modifie le filtre de rôle actif
  changerFiltreRole(role: 'tous' | RoleUtilisateur): void {
    this.filtreRole = role;
  }

  // Réinitialise la recherche et les filtres
  reinitialiserFiltres(): void {
    this.recherche = '';
    this.filtreRole = 'tous';
  }

  // Action administrateur : modifie le statut de vérification d'un utilisateur
  async changerStatutVerification(u: User, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const nouveauStatut = select.value as StatutVerification;

    if (!u.uid || u.statutVerification === nouveauStatut) return;

    const ancienStatut = u.statutVerification;
    this.actionEnCours = true;

    try {
      await this.userService.updateUser(u.uid, {
        statutVerification: nouveauStatut
      });

      u.statutVerification = nouveauStatut;

      // Notification informative à l'utilisateur
      let contenu = "Votre statut de vérification d'identité a été mis à jour par un administrateur.";
      if (nouveauStatut === 'verifie') {
        contenu = "Félicitations ! Votre profil a été vérifié et certifié par un administrateur.";
      } else if (nouveauStatut === 'refuse') {
        contenu = "Votre vérification d'identité a été marquée comme refusée. Consultez votre profil pour en savoir plus.";
      }

      await this.notificationService.create({
        userId: u.uid,
        type: 'verification',
        contenu,
        lien: '/profil',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.toastService.succes(`Statut de ${u.nom} mis à jour avec succès : ${nouveauStatut}.`);
    } catch (err: any) {
      select.value = ancienStatut;
      this.toastService.erreur(err?.message || 'Erreur lors de la mise à jour du statut.');
    } finally {
      this.actionEnCours = false;
    }
  }
}
