import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './inscription.component.html',
  styleUrls: ['./inscription.component.css']
})
export class InscriptionComponent implements OnInit {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  nom: string = '';
  email: string = '';
  motDePasse: string = '';
  confirmation: string = '';
  role: 'etudiant' | 'proprietaire' = 'etudiant';

  chargement: boolean = false;
  erreur: string | null = null;

  // Redirige immédiatement si l'utilisateur est déjà authentifié
  async ngOnInit(): Promise<void> {
    const user = await this.authService.attendreAuth();
    if (user) {
      this.router.navigate([this.authService.getHomeRoute(user.role)]);
    }
  }

  // Valide les champs et déclenche l'inscription auprès d'AuthService
  async sInscrire(): Promise<void> {
    this.erreur = null;

    // Validation des champs obligatoires
    if (!this.nom.trim() || !this.email.trim() || !this.motDePasse || !this.confirmation) {
      this.erreur = 'Veuillez remplir tous les champs du formulaire.';
      return;
    }

    // Validation de la longueur du mot de passe
    if (this.motDePasse.length < 6) {
      this.erreur = 'Le mot de passe doit comporter au moins 6 caractères.';
      return;
    }

    // Validation de la confirmation du mot de passe
    if (this.motDePasse !== this.confirmation) {
      this.erreur = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.chargement = true;

    try {
      const user = await this.authService.register(
        this.nom,
        this.email,
        this.motDePasse,
        this.role
      );

      this.toastService.succes('Compte créé avec succès ! Bienvenue sur CampusColoc.');

      // Gestion de la redirection post-inscription
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      if (redirect && this.authService.isRouteAllowedForRole(redirect, user.role)) {
        this.router.navigateByUrl(redirect);
      } else {
        this.router.navigate([this.authService.getHomeRoute(user.role)]);
      }
    } catch (err: any) {
      this.erreur = this.authService.traduireErreurAuth(err?.code || '') || err?.message || "Erreur lors de l'inscription.";
    } finally {
      this.chargement = false;
    }
  }
}
