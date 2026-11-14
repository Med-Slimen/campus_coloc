import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { AuthService } from '../../services/auth.service';
import { VerificationService } from '../../services/verification.service';
import { AnnonceService } from '../../services/annonce.service';
import { UserService } from '../../services/user.service';
import { SignalementService } from '../../services/signalement.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  public authService = inject(AuthService);
  private verificationService = inject(VerificationService);
  private annonceService = inject(AnnonceService);
  private userService = inject(UserService);
  private signalementService = inject(SignalementService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // État d'ouverture du volet tiroir mobile
  sidebarOuverte: boolean = false;

  // Titre dynamique de la page courante
  titrePage: string = 'Tableau de bord';

  // Badges de comptage pour la navigation
  nbVerificationsEnAttente: number = 0;
  nbAnnoncesEnAttente: number = 0;
  nbUtilisateurs: number = 0;
  nbSignalementsOuverts: number = 0;

  get adminNom(): string {
    return this.authService.currentUser?.nom || 'Administrateur';
  }

  ngOnInit(): void {
    this.mettreAJourTitre(this.router.url);

    // Écoute des changements de route pour adapter le titre
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.mettreAJourTitre(event.urlAfterRedirects || event.url);
        this.fermerSidebar();
      });

    this.chargerCompteurs();
  }

  // Charge les données réelles pour afficher les badges compteurs du menu
  async chargerCompteurs(): Promise<void> {
    try {
      const [verifs, annonces, users, signalements] = await Promise.all([
        this.verificationService.getEnAttente(),
        this.annonceService.getAllAnnonces(),
        this.userService.getAllUsers(),
        this.signalementService.getSignalementsOuverts()
      ]);

      this.nbVerificationsEnAttente = verifs.length;
      this.nbAnnoncesEnAttente = annonces.filter(a => a.statut === 'en_attente').length;
      this.nbUtilisateurs = users.length;
      this.nbSignalementsOuverts = signalements.length;
    } catch (err) {
      console.error('Erreur chargement compteurs admin:', err);
    }
  }

  // Met à jour le titre affiché dans la barre supérieure selon l'URL
  private mettreAJourTitre(url: string): void {
    if (url.includes('/admin/verifications')) {
      this.titrePage = "Vérifications d'identité";
    } else if (url.includes('/admin/annonces')) {
      this.titrePage = 'Modération des annonces';
    } else if (url.includes('/admin/utilisateurs')) {
      this.titrePage = 'Répertoire des utilisateurs';
    } else if (url.includes('/admin/signalements')) {
      this.titrePage = 'Gestion des signalements';
    } else {
      this.titrePage = 'Tableau de bord';
    }
  }

  // Bascule la barre latérale sur mobile
  basculerSidebar(): void {
    this.sidebarOuverte = !this.sidebarOuverte;
  }

  // Ferme la barre latérale sur mobile
  fermerSidebar(): void {
    this.sidebarOuverte = false;
  }

  // Déconnecte l'administrateur
  async seDeconnecter(): Promise<void> {
    try {
      await this.authService.logout();
      this.toastService.info('Session administrateur clôturée.');
      this.router.navigate(['/connexion']);
    } catch {
      this.toastService.erreur('Erreur lors de la déconnexion.');
    }
  }
}
