import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde d'authentification (authGuard).
 *
 * Fonctionnement pour les débutants :
 * 1. On attend que Firebase confirme si l'utilisateur est connecté grâce à attendreAuth().
 * 2. Si l'utilisateur est connecté, on le laisse passer (return true).
 * 3. S'il n'est pas connecté, on le redirige vers /connexion en mémorisant l'adresse qu'il voulait ouvrir.
 */
export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // On attend que Firebase vérifie la session
  await authService.attendreAuth();

  // Utilisateur connecté : accès autorisé
  if (authService.currentUser) {
    return true;
  }

  // Utilisateur non connecté : redirection vers la page de connexion
  return router.createUrlTree(['/connexion'], {
    queryParams: { redirect: state.url }
  });
};

