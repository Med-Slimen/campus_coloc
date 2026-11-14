import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde visiteur (visiteurGuard).
 *
 * Fonctionnement pour les débutants :
 * Si un utilisateur déjà connecté tente d'accéder à la page de connexion ou d'inscription,
 * ce garde le redirige immédiatement vers son tableau de bord approprié.
 */
export const visiteurGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // On attend que l'état d'authentification Firebase soit disponible
  await authService.attendreAuth();

  // Si l'utilisateur est déjà connecté, on l'oriente vers son tableau de bord
  if (authService.currentUser) {
    const routeAccueil = authService.getHomeRoute(authService.currentUser.role);
    return router.createUrlTree([routeAccueil]);
  }

  // Sinon, c'est un visiteur, il peut voir la page de connexion ou inscription
  return true;
};

