import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.css']
})
export class AvatarComponent {
  // Nom complet de l'utilisateur servant à extraire les initiales
  @Input() nom: string = '';

  // URL ou chaîne base64 de la photo de profil optionnelle
  @Input() photoUrl?: string | null;

  // Diamètre en pixels de l'avatar circulaire
  @Input() taille: number = 36;

  // Rôle de l'utilisateur pour adapter la couleur de fond
  @Input() role?: 'etudiant' | 'proprietaire' | 'admin';

  // Extrait une ou deux initiales en majuscules depuis le nom complet
  get initiales(): string {
    if (!this.nom) return '?';
    const morceaux = this.nom.trim().split(/\s+/);
    if (morceaux.length === 1) {
      return morceaux[0].substring(0, 2).toUpperCase();
    }
    return (morceaux[0][0] + morceaux[morceaux.length - 1][0]).toUpperCase();
  }

  // Calcule la taille de police proportionnelle au diamètre
  get taillePolice(): number {
    return Math.max(10, Math.round(this.taille * 0.4));
  }
}

