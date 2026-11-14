import { Injectable } from '@angular/core';

export type RoleUtilisateur = 'visiteur' | 'etudiant' | 'proprietaire' | 'admin';
export type StatutVerification = 'non_verifie' | 'en_attente' | 'verifie' | 'refuse';

@Injectable({
  providedIn: 'root'
})
export class SessionPreviewService {
  // Rôle actuel simulé pour tester les différentes vues et layouts
  roleActuel: RoleUtilisateur = 'visiteur';

  // Statut de vérification simulé pour afficher ou masquer le bandeau
  statutVerification: StatutVerification = 'non_verifie';

  // Nom complet de l'utilisateur simulé
  nomUtilisateur: string = 'Sami Ben Ali';

  // Modifie le rôle simulé pour tester les variantes de barre de navigation
  changerRole(role: RoleUtilisateur): void {
    this.roleActuel = role;
  }

  // Modifie le statut de vérification simulé
  changerStatutVerification(statut: StatutVerification): void {
    this.statutVerification = statut;
  }

  // Indique si l'utilisateur est considéré comme connecté
  get estConnecte(): boolean {
    return this.roleActuel !== 'visiteur';
  }

  // Indique si le bandeau de vérification doit être visible
  get afficherBandeauVerification(): boolean {
    return this.estConnecte && this.statutVerification !== 'verifie' && this.roleActuel !== 'admin';
  }
}

