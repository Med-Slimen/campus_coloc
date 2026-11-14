import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

// Initialisation de l'application Firebase avec les clés de configuration
const app = initializeApp(environment.firebaseConfig);

// Service d'authentification Firebase (connexion, inscription, gestion des sessions)
export const auth = getAuth(app);

// Base de données Firestore avec l'option experimentalForceLongPolling pour garantir la connexion en réseau restreint
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

