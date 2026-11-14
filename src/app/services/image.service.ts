import { Injectable } from '@angular/core';

// Service utilitaire pour la compression et le redimensionnement d'images avant envoi à Firestore
@Injectable({
  providedIn: 'root'
})
export class ImageService {
  /**
   * Compresse une image :
   * - Redimensionne à une largeur maximale de 800 px (conserve le ratio).
   * - Exporte au format JPEG avec une qualité de 0.7.
   * - Renvoie le résultat sous forme de texte base64 (Data URL).
   * - Déclenche une erreur explicite en français si le résultat dépasse 200 Ko.
   */
  async compressImage(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Vérification du type de fichier
      if (!file.type.startsWith('image/')) {
        reject(new Error('Le fichier sélectionné doit être une image.'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Erreur lors de la lecture du fichier image."));
      };

      reader.onload = () => {
        const img = new Image();

        img.onerror = () => {
          reject(new Error("Impossible de charger l'image pour le traitement."));
        };

        img.onload = () => {
          try {
            const maxWidth = 800;
            let width = img.width;
            let height = img.height;

            // Redimensionnement proportionnel si la largeur dépasse 800px
            if (width > maxWidth) {
              const ratio = maxWidth / width;
              width = maxWidth;
              height = Math.round(height * ratio);
            }

            // Création d'un canevas pour le dessin et la compression
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Impossible d'initialiser le contexte graphique pour la compression."));
              return;
            }

            // Dessin de l'image redimensionnée
            ctx.drawImage(img, 0, 0, width, height);

            // Exportation en JPEG avec une qualité de 0.7
            const base64Data = canvas.toDataURL('image/jpeg', 0.7);

            // Calcul précis de la taille binaire du base64 (en octets)
            const base64Payload = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            const padding = base64Payload.endsWith('==') ? 2 : base64Payload.endsWith('=') ? 1 : 0;
            const tailleEnOctets = (base64Payload.length * (3 / 4)) - padding;
            const tailleMaxOctets = 200 * 1024; // 200 Ko

            if (tailleEnOctets > tailleMaxOctets) {
              reject(new Error("L'image compressée dépasse la taille maximale autorisée de 200 Ko."));
              return;
            }

            resolve(base64Data);
          } catch (err: unknown) {
            reject(err instanceof Error ? err : new Error("Erreur inattendue lors de la compression de l'image."));
          }
        };

        img.src = reader.result as string;
      };

      reader.readAsDataURL(file);
    });
  }
}

