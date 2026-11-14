import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './connexion.component.html',
  styleUrls: ['./connexion.component.css']
})
export class ConnexionComponent implements OnInit {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email: string = '';
  motDePasse: string = '';
  chargement: boolean = false;
  erreur: string | null = null;

  // Redirige immédiatement si l'utilisateur est déjà connecté
  async ngOnInit(): Promise<void> {
    const user = await this.authService.attendreAuth();
    if (user) {
      this.router.navigate([this.authService.getHomeRoute(user.role)]);
    }
  }

  // Soumet les identifiants de connexion à Firebase Auth
  async seConnecter(): Promise<void> {
    this.erreur = null;

    if (!this.email.trim() || !this.motDePasse) {
      this.erreur = 'Veuillez renseigner votre adresse email et votre mot de passe.';
      return;
    }

    this.chargement = true;

    try {
      const user = await this.authService.login(this.email, this.motDePasse);

      this.toastService.succes(`Bienvenue de retour, ${user.nom || 'cher utilisateur'} !`);

      // Redirection selon le paramètre de retour ou le rôle de l'utilisateur
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      if (redirect && this.authService.isRouteAllowedForRole(redirect, user.role)) {
        this.router.navigateByUrl(redirect);
      } else {
        this.router.navigate([this.authService.getHomeRoute(user.role)]);
      }
    } catch (err: any) {
      this.erreur = this.authService.traduireErreurAuth(err?.code || '') || err?.message || 'Erreur lors de la connexion.';
    } finally {
      this.chargement = false;
    }
  }
}
