import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Annonce } from '../../models';

@Component({
  selector: 'app-annonce-card',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './annonce-card.component.html',
  styleUrls: ['./annonce-card.component.css']
})
export class AnnonceCardComponent {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  // Données de l'annonce immobilière
  @Input({ required: true }) annonce!: Annonce;

  // Indique si l'annonce possède un espace de colocation public et ouvert
  @Input() espacePublicOuvert: boolean = false;

  // Indique si l'utilisateur connecté est un étudiant
  get estEtudiant(): boolean {
    return this.authService.currentUser?.role === 'etudiant';
  }

  // Détermine si cette annonce est actuellement dans les favoris de l'étudiant
  get estFavori(): boolean {
    return !!(this.annonce?.id && this.authService.estFavori(this.annonce.id));
  }

  // Calcule le budget estimé par colocataire (loyer + charges / nombre de places)
  get budgetParPersonne(): number {
    if (!this.annonce) return 0;
    const loyer = Number(this.annonce.loyer) || 0;
    const charges = Number(this.annonce.charges) || 0;
    const places = Math.max(1, Number(this.annonce.nombrePlaces) || 1);
    return Math.round((loyer + charges) / places);
  }

  // Renvoie la première photo de l'annonce ou null
  get premierePhoto(): string | null {
    if (this.annonce?.photos && this.annonce.photos.length > 0) {
      return this.annonce.photos[0];
    }
    return null;
  }

  // Bascule l'état favori pour les étudiants
  async basculerFavori(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!this.estEtudiant || !this.annonce?.id) return;

    try {
      if (this.estFavori) {
        await this.authService.retirerFavori(this.annonce.id);
        this.toastService.info('Annonce retirée de vos favoris.');
      } else {
        await this.authService.ajouterFavori(this.annonce.id);
        this.toastService.succes('Annonce ajoutée à vos favoris !');
      }
    } catch {
      this.toastService.erreur('Impossible de mettre à jour vos favoris.');
    }
  }
}
