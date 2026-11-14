import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RoleUtilisateur } from '../models';

/**
 * Garde par rôle (roleGuard).
 *
 * Fonctionnement pour les débutants :
 * 1. On lui donne la liste des rôles permis, par exemple : roleGuard(['etudiant', 'admin']).
 * 2. Il attend la réponse de Firebase avec attendreAuth().
 * 3. Si personne n'est connecté, il renvoie vers la page de connexion.
 * 4. Si la personne connectée a le bon rôle, elle peut voir la page.
 * 5. Sinon, elle est redirigée vers sa propre page d'accueil (tableau de bord).
 */
export const roleGuard = (rolesAutorises: RoleUtilisateur[]): CanActivateFn => {
  return async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // On attend que Firebase confirme qui est connecté
    await authService.attendreAuth();

    const utilisateur = authService.currentUser;

    // Pas de compte connecté : on renvoie vers la connexion
    if (!utilisateur) {
      return router.createUrlTree(['/connexion'], {
        queryParams: { redirect: state.url }
      });
    }

    // Le rôle de l'utilisateur est autorisé : accès accordé
    if (rolesAutorises.includes(utilisateur.role)) {
      return true;
    }

    // Rôle non autorisé : redirection vers sa page d'accueil normale
    const routeAccueil = authService.getHomeRoute(utilisateur.role);
    return router.createUrlTree([routeAccueil]);
  };
};

