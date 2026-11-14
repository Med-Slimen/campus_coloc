import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { MembreLayoutComponent } from './layouts/membre-layout/membre-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { authGuard, roleGuard, visiteurGuard } from './guards';

export const routes: Routes = [
  // 1. Layout Public (accessible à tous : visiteurs, étudiants, bailleurs)
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/accueil/accueil.component').then(m => m.AccueilComponent),
        title: 'CampusColoc — Colocation étudiante en Tunisie'
      },
      {
        path: 'annonces',
        loadComponent: () => import('./pages/annonces/annonces.component').then(m => m.AnnoncesComponent),
        title: 'Logements et colocations — CampusColoc'
      },
      {
        path: 'annonces/:id',
        loadComponent: () => import('./pages/annonce-detail/annonce-detail.component').then(m => m.AnnonceDetailComponent),
        title: 'Détail de l’annonce — CampusColoc'
      },
      {
        path: 'comment-ca-marche',
        loadComponent: () => import('./pages/disponible-bientot/disponible-bientot.component').then(m => m.DisponibleBientotComponent),
        title: 'Comment ça marche — CampusColoc'
      },
      {
        path: 'connexion',
        canActivate: [visiteurGuard],
        loadComponent: () => import('./pages/connexion/connexion.component').then(m => m.ConnexionComponent),
        title: 'Connexion — CampusColoc'
      },
      {
        path: 'inscription',
        canActivate: [visiteurGuard],
        loadComponent: () => import('./pages/inscription/inscription.component').then(m => m.InscriptionComponent),
        title: 'Créer un compte — CampusColoc'
      },
      {
        path: 'test-firebase',
        loadComponent: () => import('./pages/test-firebase/test-firebase.component').then(m => m.TestFirebaseComponent),
        title: 'Diagnostic Firebase — CampusColoc'
      },
      {
        path: '404',
        loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
        title: 'Page introuvable — CampusColoc'
      }
    ]
  },

  // 2. Layout Membre (réservé aux utilisateurs connectés)
  {
    path: '',
    component: MembreLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'profil',
        loadComponent: () => import('./pages/profil/profil.component').then(m => m.ProfilComponent),
        title: 'Mon Profil — CampusColoc'
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
        title: 'Mes Notifications — CampusColoc'
      },
      {
        path: 'favoris',
        canActivate: [roleGuard(['etudiant', 'admin'])],
        loadComponent: () => import('./pages/favoris/favoris.component').then(m => m.FavorisComponent),
        title: 'Mes Favoris — CampusColoc'
      },
      {
        path: 'demandes',
        loadComponent: () => import('./pages/demandes/demandes.component').then(m => m.DemandesComponent),
        title: 'Mes Demandes — CampusColoc'
      },
      {
        path: 'mes-annonces',
        canActivate: [roleGuard(['proprietaire', 'admin'])],
        loadComponent: () => import('./pages/mes-annonces/mes-annonces.component').then(m => m.MesAnnoncesComponent),
        title: 'Mes Annonces — CampusColoc'
      },
      {
        path: 'mes-annonces/nouvelle',
        canActivate: [roleGuard(['proprietaire', 'admin'])],
        loadComponent: () => import('./pages/mes-annonces/annonce-form/annonce-form.component').then(m => m.AnnonceFormComponent),
        title: 'Déposer une annonce — CampusColoc'
      },
      {
        path: 'mes-annonces/modifier/:id',
        canActivate: [roleGuard(['proprietaire', 'admin'])],
        loadComponent: () => import('./pages/mes-annonces/annonce-form/annonce-form.component').then(m => m.AnnonceFormComponent),
        title: 'Modifier l’annonce — CampusColoc'
      },
      {
        path: 'espace/:id',
        loadComponent: () => import('./pages/espace/espace.component').then(m => m.EspaceComponent),
        title: 'Espace de colocation — CampusColoc'
      },
      {
        path: 'etudiant',
        canActivate: [roleGuard(['etudiant', 'admin'])],
        loadComponent: () => import('./pages/dashboard-etudiant/dashboard-etudiant.component').then(m => m.DashboardEtudiantComponent),
        title: 'Espace Étudiant — CampusColoc'
      },
      {
        path: 'proprietaire',
        canActivate: [roleGuard(['proprietaire', 'admin'])],
        loadComponent: () => import('./pages/dashboard-proprietaire/dashboard-proprietaire.component').then(m => m.DashboardProprietaireComponent),
        title: 'Espace Propriétaire — CampusColoc'
      }
    ]
  },

  // 3. Layout Administration (réservé aux administrateurs)
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard(['admin'])],
    children: [
      {
        path: '',
        redirectTo: 'tableau-de-bord',
        pathMatch: 'full'
      },
      {
        path: 'tableau-de-bord',
        loadComponent: () => import('./pages/admin/admin-tableau-bord/admin-tableau-bord.component').then(m => m.AdminTableauBordComponent),
        title: 'Tableau de bord — Admin CampusColoc'
      },
      {
        path: 'verifications',
        loadComponent: () => import('./pages/admin/admin-verifications/admin-verifications.component').then(m => m.AdminVerificationsComponent),
        title: 'Vérifications d’identité — Admin CampusColoc'
      },
      {
        path: 'annonces',
        loadComponent: () => import('./pages/admin/admin-annonces/admin-annonces.component').then(m => m.AdminAnnoncesComponent),
        title: 'Modération des annonces — Admin CampusColoc'
      },
      {
        path: 'signalements',
        loadComponent: () => import('./pages/admin/admin-signalements/admin-signalements.component').then(m => m.AdminSignalementsComponent),
        title: 'Gestion des signalements — Admin CampusColoc'
      },
      {
        path: 'utilisateurs',
        loadComponent: () => import('./pages/admin/admin-utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent),
        title: 'Répertoire utilisateurs — Admin CampusColoc'
      }
    ]
  },

  // Redirection des routes inconnues vers la page 404
  {
    path: '**',
    redirectTo: '404'
  }
];
