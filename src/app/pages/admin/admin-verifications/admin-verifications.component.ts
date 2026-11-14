import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { AvatarComponent } from '../../../components/avatar/avatar.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../components/error-message/error-message.component';
import { VerificationService } from '../../../services/verification.service';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';
import { Verification, User } from '../../../models';

export interface VerificationComplete extends Verification {
  userNom: string;
  userEmail: string;
  userRole: string;
}

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    StatusBadgeComponent,
    AvatarComponent,
    LoaderComponent,
    EmptyStateComponent,
    ErrorMessageComponent
  ],
  templateUrl: './admin-verifications.component.html',
  styleUrls: ['./admin-verifications.component.css']
})
export class AdminVerificationsComponent implements OnInit {
  private verificationService = inject(VerificationService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);

  // Liste des vérifications enrichies des informations utilisateur
  verifications: VerificationComplete[] = [];
  chargement: boolean = true;
  erreur: string | null = null;

  // Gestion du volet de modération (Voir pièce)
  verifSelectionnee: VerificationComplete | null = null;
  motifRefus: string = '';
  erreurMotif: string | null = null;
  actionEnCours: boolean = false;

  ngOnInit(): void {
    this.chargerVerifications();
  }

  // Charge toutes les pièces justificatives en attente de modération
  async chargerVerifications(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    try {
      const [verifs, users] = await Promise.all([
        this.verificationService.getEnAttente(),
        this.userService.getAllUsers()
      ]);

      const mapUsers = new Map<string, User>();
      users.forEach(u => {
        if (u.uid) mapUsers.set(u.uid, u);
      });

      this.verifications = verifs.map(v => {
        const u = mapUsers.get(v.userId);
        return {
          ...v,
          userNom: u?.nom || 'Utilisateur inconnu',
          userEmail: u?.email || '',
          userRole: u?.role || 'etudiant'
        };
      });
    } catch {
      this.erreur = 'Impossible de charger la liste des vérifications.';
    } finally {
      this.chargement = false;
    }
  }

  // Ouvre le panneau de modération pour la pièce sélectionnée
  ouvrirExamen(item: VerificationComplete): void {
    this.verifSelectionnee = item;
    this.motifRefus = '';
    this.erreurMotif = null;
  }

  // Ferme le panneau d'examen
  fermerExamen(): void {
    this.verifSelectionnee = null;
    this.motifRefus = '';
    this.erreurMotif = null;
  }

  // Approuve la pièce, valide le profil de l'utilisateur et lui envoie une notification
  async approuverPiece(): Promise<void> {
    if (!this.verifSelectionnee || !this.verifSelectionnee.id) return;

    this.actionEnCours = true;
    try {
      await this.verificationService.approve(
        this.verifSelectionnee.id,
        this.verifSelectionnee.userId
      );

      this.toastService.succes(
        `Pièce approuvée pour ${this.verifSelectionnee.userNom}. Profil certifié avec succès.`
      );
      this.fermerExamen();
      await this.chargerVerifications();
    } catch {
      this.toastService.erreur("Erreur lors de la validation de la pièce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Refuse la pièce avec un motif obligatoire et notifie l'utilisateur
  async refuserPiece(): Promise<void> {
    if (!this.verifSelectionnee || !this.verifSelectionnee.id) return;

    if (!this.motifRefus.trim()) {
      this.erreurMotif = 'Le motif de refus est obligatoire pour orienter l\'utilisateur.';
      return;
    }

    this.actionEnCours = true;
    try {
      await this.verificationService.refuse(
        this.verifSelectionnee.id,
        this.verifSelectionnee.userId,
        this.motifRefus.trim()
      );

      this.toastService.avertissement(
        `Pièce refusée. Le motif a été envoyé à ${this.verifSelectionnee.userNom}.`
      );
      this.fermerExamen();
      await this.chargerVerifications();
    } catch {
      this.toastService.erreur("Erreur lors du refus de la pièce.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // Formate la date de dépôt
  formaterDate(iso?: string): string {
    if (!iso) return 'Date inconnue';
    try {
      return new Intl.DateTimeFormat('fr-TN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
