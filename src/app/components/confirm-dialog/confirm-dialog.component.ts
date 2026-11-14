import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  // Contrôle la visibilité de la boîte de dialogue modale
  @Input() ouvert: boolean = false;

  // Titre principal de la boîte de confirmation
  @Input() titre: string = 'Confirmation requise';

  // Message explicatif détaillant l'impact de l'action
  @Input() message: string = 'Êtes-vous certain de vouloir effectuer cette action ?';

  // Texte du bouton de validation
  @Input() texteConfirmer: string = 'Confirmer';

  // Texte du bouton d'annulation
  @Input() texteAnnuler: string = 'Annuler';

  // Indique si l'action est irréversible (affiche le bouton en style danger)
  @Input() dangereux: boolean = false;

  // Événement déclenché lors de la validation
  @Output() confirmer = new EventEmitter<void>();

  // Événement déclenché lors de l'annulation ou de la fermeture
  @Output() annuler = new EventEmitter<void>();

  // Valide l'opération et notifie le composant parent
  surConfirmer(): void {
    this.confirmer.emit();
  }

  // Annule l'opération et ferme la boîte de dialogue
  surAnnuler(): void {
    this.annuler.emit();
  }
}

