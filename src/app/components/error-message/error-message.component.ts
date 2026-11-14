import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-error-message',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './error-message.component.html',
  styleUrls: ['./error-message.component.css']
})
export class ErrorMessageComponent {
  // Message d'erreur textuel affiché à l'utilisateur
  @Input() message: string = 'Une erreur est survenue lors du chargement des données.';

  // Indique si le bouton de nouvelle tentative doit être affiché
  @Input() reessayerVisible: boolean = true;

  // Libellé du bouton de nouvelle tentative
  @Input() texteBouton: string = 'Réessayer';

  // Événement déclenché lors du clic sur Réessayer
  @Output() reessayer = new EventEmitter<void>();

  // Émet l'événement pour relancer l'opération
  surReessayer(): void {
    this.reessayer.emit();
  }
}

