import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { IconComponent } from '../../../components/icon/icon.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { AnnonceService } from '../../../services/annonce.service';
import { ImageService } from '../../../services/image.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Annonce, VILLES_TUNISIE } from '../../../models';

@Component({
  selector: 'app-annonce-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, LoaderComponent],
  templateUrl: './annonce-form.component.html',
  styleUrls: ['./annonce-form.component.css']
})
export class AnnonceFormComponent implements OnInit {
  private annonceService = inject(AnnonceService);
  private imageService = inject(ImageService);
  public authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Liste immuable des gouvernorats de Tunisie
  readonly villes = VILLES_TUNISIE;

  // Options strictes de durée de location
  readonly optionsDuree = [
    '1 semestre',
    '1 année universitaire',
    '1 à 3 mois',
    'Flexible'
  ];

  // Mode du formulaire
  modeEdition: boolean = false;
  annonceId: string | null = null;

  // Champs du formulaire
  titre: string = '';
  description: string = '';
  ville: string = '';
  quartier: string = '';
  loyer: number | null = null;
  charges: number = 0;
  nombrePlaces: number = 2;
  meuble: boolean = true;
  dureeLocation: string = '1 année universitaire';
  photos: string[] = [];

  // États de chargement et d'erreur
  chargement: boolean = false;
  chargementPhoto: boolean = false;
  erreur: string | null = null;

  // Vérifie si le propriétaire connecté a un profil certifié
  get estVerifie(): boolean {
    const user = this.authService.currentUser;
    return user?.statutVerification === 'verifie' || user?.role === 'admin';
  }

  // Calcul en direct du budget par personne en DT
  get budgetParPersonne(): number {
    const l = Number(this.loyer) || 0;
    const c = Number(this.charges) || 0;
    const p = Math.max(1, Number(this.nombrePlaces) || 1);
    return Math.round((l + c) / p);
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    this.annonceId = this.route.snapshot.paramMap.get('id');

    if (this.annonceId) {
      this.modeEdition = true;
      await this.chargerAnnonce(this.annonceId);
    }
  }

  // Charge les données de l'annonce en mode édition
  async chargerAnnonce(id: string): Promise<void> {
    this.chargement = true;
    this.erreur = null;
    try {
      const a = await this.annonceService.getById(id);
      if (!a) {
        this.erreur = "Cette annonce est introuvable.";
        return;
      }

      // Vérification des droits de modification
      const user = this.authService.currentUser;
      if (user && a.proprietaireId !== user.uid && user.role !== 'admin') {
        this.erreur = "Vous n'êtes pas autorisé à modifier ce logement.";
        return;
      }

      this.titre = a.titre || '';
      this.description = a.description || '';
      this.ville = a.ville || '';
      this.quartier = a.quartier || '';
      this.loyer = a.loyer || null;
      this.charges = a.charges || 0;
      this.nombrePlaces = a.nombrePlaces || 1;
      this.meuble = a.meuble ?? true;
      this.dureeLocation = a.dureeLocation || '1 année universitaire';
      this.photos = a.photos ? [...a.photos] : [];
    } catch {
      this.erreur = "Erreur lors de la récupération des détails de l'annonce.";
    } finally {
      this.chargement = false;
    }
  }

  // Ajoute une photo compressée (maximum 4 photos de 200 Ko maximum)
  async ajouterPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    if (this.photos.length >= 4) {
      this.toastService.avertissement('Vous pouvez ajouter 4 photos au maximum.');
      input.value = '';
      return;
    }

    const file = input.files[0];
    this.chargementPhoto = true;

    try {
      const base64 = await this.imageService.compressImage(file);
      this.photos.push(base64);
      this.toastService.succes('Photo compressée et ajoutée avec succès.');
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'optimisation de la photo.");
    } finally {
      this.chargementPhoto = false;
      input.value = '';
    }
  }

  // Supprime une photo de la liste
  supprimerPhoto(index: number): void {
    this.photos.splice(index, 1);
  }

  // Enregistre l'annonce (création ou modification) avec contrôle strict de la vérification
  async enregistrer(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.toastService.erreur("Vous devez être connecté pour publier une annonce.");
      return;
    }

    // Règle 4 : Si le propriétaire n'est pas vérifié, la fonction de sauvegarde refuse
    if (!this.estVerifie) {
      this.erreur = "Votre profil n'est pas encore certifié. Vous devez faire valider votre CIN avant de publier une annonce.";
      this.toastService.erreur(this.erreur);
      return;
    }

    // Validation des champs requis
    if (!this.titre.trim() || !this.description.trim() || !this.ville || !this.quartier.trim()) {
      this.erreur = 'Veuillez remplir tous les champs obligatoires (titre, description, gouvernorat, quartier).';
      return;
    }

    if (!this.loyer || this.loyer <= 0) {
      this.erreur = 'Veuillez indiquer un loyer mensuel valide supérieur à 0 DT.';
      return;
    }

    this.chargement = true;
    this.erreur = null;

    try {
      if (this.modeEdition && this.annonceId) {
        // En mode édition : repasse en_attente et vide motifRefus
        await this.annonceService.update(this.annonceId, {
          titre: this.titre.trim(),
          description: this.description.trim(),
          ville: this.ville,
          quartier: this.quartier.trim(),
          loyer: Number(this.loyer),
          charges: Number(this.charges) || 0,
          nombrePlaces: Number(this.nombrePlaces) || 1,
          meuble: this.meuble,
          dureeLocation: this.dureeLocation,
          photos: this.photos
        });

        this.toastService.succes(
          "Annonce mise à jour avec succès. Elle a été renvoyée en modération."
        );
      } else {
        // En mode création : nouveau document avec statut initial en_attente
        await this.annonceService.create({
          proprietaireId: user.uid,
          titre: this.titre.trim(),
          description: this.description.trim(),
          ville: this.ville,
          quartier: this.quartier.trim(),
          loyer: Number(this.loyer),
          charges: Number(this.charges) || 0,
          nombrePlaces: Number(this.nombrePlaces) || 1,
          meuble: this.meuble,
          dureeLocation: this.dureeLocation,
          photos: this.photos,
          statut: 'en_attente',
          dateCreation: new Date().toISOString()
        });

        this.toastService.succes(
          "Votre annonce a été transmise avec succès ! Elle est en cours d'examen par notre équipe."
        );
      }

      this.router.navigate(['/mes-annonces']);
    } catch (err: any) {
      const msg = err?.message || "Erreur lors de l'enregistrement de l'annonce.";
      this.erreur = msg;
      this.toastService.erreur(msg);
    } finally {
      this.chargement = false;
    }
  }
}
