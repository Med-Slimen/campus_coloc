import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.css']
})
export class EmptyStateComponent {
  // Titre principal de l'état vide
  @Input() titre: string = 'Aucun élément trouvé';

  // Description explicative ou conseil
  @Input() description: string = '';

  // Nom de l'icône à afficher au centre
  @Input() icone: string = 'inbox';

  // Libellé optionnel du bouton d'action
  @Input() texteAction?: string;

  // Événement émis lors du clic sur le bouton d'action
  @Output() action = new EventEmitter<void>();

  // Déclenche l'événement d'action
  surClicAction(): void {
    this.action.emit();
  }
}

