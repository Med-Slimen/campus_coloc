import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css']
})
export class LoaderComponent {
  // Type de squelette à afficher: lignes, carte individuelle, grille de cartes ou tableau
  @Input() type: 'lines' | 'card' | 'cards' | 'table' = 'card';

  // Nombre de lignes ou d'éléments répétitifs
  @Input() count: number = 3;

  // Génère un tableau d'indices pour la répétition dans le template
  get elements(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}

