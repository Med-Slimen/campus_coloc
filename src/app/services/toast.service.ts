import { Injectable } from '@angular/core';
import { Toast, TypeToast } from '../models/toast.model';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  // Liste en mémoire des notifications toast actuellement actives
  toasts: Toast[] = [];

  // Affiche une notification de succès (vert olive)
  succes(message: string, dureeMs: number = 4000): void {
    this.ajouter('succes', message, dureeMs);
  }

  // Affiche une notification d'erreur (rouge brique)
  erreur(message: string, dureeMs: number = 5000): void {
    this.ajouter('erreur', message, dureeMs);
  }

  // Affiche une notification d'information (bleu Sidi Bou Saïd)
  info(message: string, dureeMs: number = 4000): void {
    this.ajouter('info', message, dureeMs);
  }

  // Affiche une notification d'avertissement (ocre soleil)
  avertissement(message: string, dureeMs: number = 4500): void {
    this.ajouter('avertissement', message, dureeMs);
  }

  // Retire une notification manuellement via son identifiant
  retirer(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  // Crée et enregistre une nouvelle notification avec un minuteur de disparition
  private ajouter(type: TypeToast, message: string, dureeMs: number): void {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const toast: Toast = { id, type, message, dureeMs };

    this.toasts.push(toast);

    if (dureeMs > 0) {
      setTimeout(() => {
        this.retirer(id);
      }, dureeMs);
    }
  }
}

