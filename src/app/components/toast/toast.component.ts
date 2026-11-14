import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { Toast } from '../../models/toast.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  // Ferme une notification toast par son identifiant
  fermer(id: string): void {
    this.toastService.retirer(id);
  }

  // Renvoie le nom de l'icône correspondant au type de toast
  obtenirIcone(type: string): string {
    switch (type) {
      case 'succes': return 'check';
      case 'erreur': return 'alert';
      case 'avertissement': return 'alert';
      default: return 'bell';
    }
  }
}

