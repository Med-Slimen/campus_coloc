import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.css']
})
export class IconComponent {
  // Nom de l'icône à afficher parmi les 34 icônes du système
  @Input() name: string = '';

  // Taille de l'icône en pixels (hauteur et largeur égales)
  @Input() size: number | string = 20;

  // Calcule la dimension sous forme de chaîne avec unité px
  get dimension(): string {
    return typeof this.size === 'number' ? `${this.size}px` : this.size;
  }
}

