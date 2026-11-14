import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { StatutVerification, RoleUtilisateur } from '../../models';

@Component({
  selector: 'app-verification-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './verification-banner.component.html',
  styleUrls: ['./verification-banner.component.css']
})
export class VerificationBannerComponent {
  public authService = inject(AuthService);

  get role(): RoleUtilisateur {
    return this.authService.currentUser?.role || 'etudiant';
  }

  get statutVerification(): StatutVerification {
    return this.authService.currentUser?.statutVerification || 'non_verifie';
  }

  // Jamais affiché pour les administrateurs ni pour les profils déjà vérifiés
  get afficher(): boolean {
    if (this.role === 'admin') {
      return false;
    }
    return this.statutVerification !== 'verifie';
  }

  // Message explicite détaillant les actions bloquées tant que le compte n'est pas validé
  get message(): string {
    const estEtudiant = this.role === 'etudiant';

    if (this.statutVerification === 'en_attente') {
      return estEtudiant
        ? "Votre document est en cours d'examen par notre équipe. Vous pourrez envoyer des candidatures dès sa validation."
        : "Votre CIN est en cours de contrôle par la modération. La publication de vos annonces sera autorisée sous peu.";
    }

    if (this.statutVerification === 'refuse') {
      return estEtudiant
        ? "Votre justificatif a été refusé. L'envoi de demandes est bloqué. Veuillez déposer un document valide sur votre profil."
        : "Votre CIN a été refusée. La publication de logements est bloquée. Veuillez déposer un justificatif lisible sur votre profil.";
    }

    // Statut non_verifie
    return estEtudiant
      ? "Compte non vérifié : vous ne pouvez pas encore envoyer de demandes de colocation. Déposez votre carte étudiante ou CIN pour débloquer l'accès."
      : "Compte non vérifié : vous ne pouvez pas encore publier d'annonces de colocation. Déposez votre pièce d'identité (CIN) pour débloquer la publication.";
  }

  get libelleBouton(): string {
    return this.statutVerification === 'en_attente' ? 'Consulter mon profil' : 'Vérifier mon compte';
  }
}
