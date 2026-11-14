import { Injectable, inject } from '@angular/core';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { UserService } from './user.service';
import { User, RoleUtilisateur } from '../models';

/**
 * Service central d'authentification pour CampusColoc.
 * Gère la session Firebase Auth et synchronise le profil utilisateur stocké dans Firestore.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userService = inject(UserService);

  // Document Firestore de l'utilisateur actuellement connecté
  currentUser: User | null = null;

  // Promesse résolue dès que le statut initial Firebase Auth est connu
  private authInitialiseePromise: Promise<User | null>;
  private estInitialise: boolean = false;

  // Verrou évitant d'écraser un utilisateur en cours d'enregistrement
  private inscriptionEnCours: boolean = false;

  constructor() {
    this.authInitialiseePromise = new Promise((resolve) => {
      // Écoute les changements d'état d'authentification Firebase
      onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            // Lecture du document profil dans Firestore
            let userDoc = await this.userService.getUser(firebaseUser.uid);

            // Si le document n'est pas encore accessible, attendre 500 ms et réessayer une fois
            if (!userDoc) {
              await new Promise(r => setTimeout(r, 500));
              userDoc = await this.userService.getUser(firebaseUser.uid);
            }

            if (userDoc) {
              this.currentUser = userDoc;
            }
          } catch (err) {
            console.error('Erreur lors de la récupération du profil utilisateur :', err);
          }
        } else {
          // Ne jamais écraser un utilisateur défini par register avec null
          if (!this.inscriptionEnCours) {
            this.currentUser = null;
          }
        }

        if (!this.estInitialise) {
          this.estInitialise = true;
          resolve(this.currentUser);
        }
      });
    });
  }

  // Attend la vérification initiale de l'état d'authentification Firebase
  async attendreAuth(): Promise<User | null> {
    if (this.estInitialise) {
      return this.currentUser;
    }
    return this.authInitialiseePromise;
  }

  // Crée un nouveau compte Firebase Auth et enregistre le document users/{uid}
  async register(
    nom: string,
    email: string,
    motDePasse: string,
    role: 'etudiant' | 'proprietaire'
  ): Promise<User> {
    if (role !== 'etudiant' && role !== 'proprietaire') {
      throw new Error('Le rôle doit être soit étudiant soit propriétaire.');
    }

    this.inscriptionEnCours = true;

    try {
      // 1. Création du compte dans Firebase Auth
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), motDePasse);
      const uid = credential.user.uid;

      // 2. Préparation du document profil utilisateur
      const nouveauProfil: User = {
        uid,
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        telephone: '',
        photo: null,
        role,
        statutVerification: 'non_verifie',
        faculte: '',
        niveau: '',
        filiere: '',
        favoris: [],
        dateInscription: new Date().toISOString()
      };

      // 3. Enregistrement dans la collection users/{uid}
      await this.userService.createUser(uid, nouveauProfil);

      // On affecte immédiatement le profil en mémoire pour éviter toute écrasure prématurée
      this.currentUser = nouveauProfil;

      // 4. Vérification de la présence du document avec pause de 500ms si nécessaire
      let verifDoc = await this.userService.getUser(uid);
      if (!verifDoc) {
        await new Promise(r => setTimeout(r, 500));
        verifDoc = await this.userService.getUser(uid);
      }

      if (verifDoc) {
        this.currentUser = verifDoc;
      }

      return this.currentUser;
    } finally {
      this.inscriptionEnCours = false;
    }
  }

  // Connecte un utilisateur existant avec son email et mot de passe
  async login(email: string, motDePasse: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
    const uid = credential.user.uid;

    let userDoc = await this.userService.getUser(uid);
    if (!userDoc) {
      await new Promise(r => setTimeout(r, 500));
      userDoc = await this.userService.getUser(uid);
    }

    if (!userDoc) {
      throw new Error('Votre profil utilisateur est introuvable.');
    }

    this.currentUser = userDoc;
    return this.currentUser;
  }

  // Déconnecte l'utilisateur et réinitialise la session locale
  async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
  }

  // Renvoie la route de redirection par défaut selon le rôle
  getHomeRoute(role?: string | null): string {
    if (role === 'admin') {
      return '/admin/tableau-de-bord';
    }
    if (role === 'etudiant') {
      return '/etudiant';
    }
    if (role === 'proprietaire') {
      return '/proprietaire';
    }
    return '/';
  }

  // Vérifie si une route demandée en paramètre redirect est autorisée pour le rôle
  isRouteAllowedForRole(route: string, role?: RoleUtilisateur | null): boolean {
    if (!route || typeof route !== 'string') {
      return false;
    }

    // Protection des pages d'administration
    if (route.startsWith('/admin') && role !== 'admin') {
      return false;
    }

    // Protection des pages propriétaires
    if ((route.startsWith('/proprietaire') || route.startsWith('/mes-annonces')) && role !== 'proprietaire' && role !== 'admin') {
      return false;
    }

    // Protection des pages étudiants
    if ((route.startsWith('/etudiant') || route.startsWith('/favoris')) && role !== 'etudiant' && role !== 'admin') {
      return false;
    }

    return true;
  }

  // Traduit les codes d'erreur techniques Firebase Auth en messages clairs en français
  traduireErreurAuth(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà associée à un compte.';
      case 'auth/invalid-email':
        return "L'adresse email saisie n'est pas valide.";
      case 'auth/operation-not-allowed':
        return "L'inscription par email n'est pas activée sur ce projet.";
      case 'auth/weak-password':
        return 'Le mot de passe doit comporter au moins 6 caractères.';
      case 'auth/user-disabled':
        return 'Ce compte utilisateur a été désactivé.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Adresse email ou mot de passe incorrect.';
      case 'auth/too-many-requests':
        return 'Trop de tentatives infructueuses. Veuillez patienter avant de réessayer.';
      case 'auth/network-request-failed':
        return 'Erreur de connexion au serveur. Vérifiez votre connexion internet.';
      default:
        return "Une erreur est survenue lors de l'authentification.";
    }
  }

  // Vérifie si une annonce figure dans les favoris de l'utilisateur connecté
  estFavori(annonceId: string): boolean {
    return !!(this.currentUser?.favoris && this.currentUser.favoris.includes(annonceId));
  }

  // Ajoute une annonce aux favoris via UserService.addFavori
  async ajouterFavori(annonceId: string): Promise<void> {
    if (!this.currentUser?.uid) return;
    await this.userService.addFavori(this.currentUser.uid, annonceId);
    if (!this.currentUser.favoris) {
      this.currentUser.favoris = [];
    }
    if (!this.currentUser.favoris.includes(annonceId)) {
      this.currentUser.favoris.push(annonceId);
    }
  }

  // Retire une annonce des favoris via UserService.removeFavori
  async retirerFavori(annonceId: string): Promise<void> {
    if (!this.currentUser?.uid) return;
    await this.userService.removeFavori(this.currentUser.uid, annonceId);
    if (this.currentUser.favoris) {
      this.currentUser.favoris = this.currentUser.favoris.filter(id => id !== annonceId);
    }
  }
}

