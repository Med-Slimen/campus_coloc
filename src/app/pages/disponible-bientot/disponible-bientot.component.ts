import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-disponible-bientot',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './disponible-bientot.component.html',
  styleUrls: ['./disponible-bientot.component.css']
})
export class DisponibleBientotComponent {
  // Page de transition pour les fonctionnalités en cours de développement
}

