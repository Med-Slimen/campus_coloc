import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.css']
})
export class StatusBadgeComponent {
  // Code technique du statut (issu du modèle de données)
  @Input() statut: string = '';

  // Libellé optionnel de remplacement si on souhaite forcer un affichage personnalisé
  @Input() textePersonnalise?: string;

  // Calcule la classe CSS appropriée selon la signification du statut
  get classeBadge(): string {
    switch (this.statut) {
      case 'publiee':
      case 'verifie':
      case 'acceptee':
      case 'traite':
      case 'ouvert':
      case 'public':
      case 'confirme':
        return 'badge-ok';

      case 'en_attente':
      case 'demande':
      case 'invite':
        return 'badge-sun';

      case 'suspendue':
      case 'complet':
      case 'non_verifie':
        return 'badge-warn';

      case 'refusee':
      case 'refuse':
      case 'ferme':
        return 'badge-danger';

      case 'louee':
      case 'annulee':
      case 'prive':
      default:
        return 'badge-neutral';
    }
  }

  // Renvoie le libellé en français clair correspondant au statut
  get libelle(): string {
    if (this.textePersonnalise) {
      return this.textePersonnalise;
    }

    switch (this.statut) {
      case 'non_verifie': return 'Non vérifié';
      case 'en_attente': return 'En cours de vérification';
      case 'verifie': return 'Vérifié';
      case 'refuse':
      case 'refusee': return 'Refusé';
      case 'publiee': return 'Publiée';
      case 'suspendue': return 'Suspendue';
      case 'acceptee': return 'Acceptée';
      case 'annulee': return 'Annulée';
      case 'ouvert': return 'Ouvert';
      case 'complet': return 'Complet';
      case 'confirme': return 'Confirmé';
      case 'ferme': return 'Fermé';
      case 'louee': return 'Louée';
      case 'traite': return 'Traité';
      case 'prive': return 'Privé';
      case 'public': return 'Public';
      case 'invite': return 'Invité';
      case 'demande': return 'Demande';
      default: return this.statut || 'Inconnu';
    }
  }
}

