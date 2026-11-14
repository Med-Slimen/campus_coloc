import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../../components/icon/icon.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { AvatarComponent } from '../../../components/avatar/avatar.component';
import { LoaderComponent } from '../../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../../components/error-message/error-message.component';
import { UserService } from '../../../services/user.service';
import { AnnonceService } from '../../../services/annonce.service';
import { DemandeService } from '../../../services/demande.service';
import { VerificationService } from '../../../services/verification.service';
import { User, Annonce, Verification } from '../../../models';

export interface VerificationAvecAuteur extends Verification {
  userNom?: string;
  userEmail?: string;
  userRole?: string;
}

export interface StatutAnnonceStats {
  statut: string;
  libelle: string;
  count: number;
  pourcentage: number;
  couleurClass: string;
}

@Component({
  selector: 'app-admin-tableau-bord',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    StatusBadgeComponent,
    AvatarComponent,
    LoaderComponent,
    ErrorMessageComponent
  ],
  templateUrl: './admin-tableau-bord.component.html',
  styleUrls: ['./admin-tableau-bord.component.css']
})
export class AdminTableauBordComponent implements OnInit {
  private userService = inject(UserService);
  private annonceService = inject(AnnonceService);
  private demandeService = inject(DemandeService);
  private verificationService = inject(VerificationService);

  // Indicateurs d'état du chargement
  chargement: boolean = true;
  erreur: string | null = null;

  // 1. KPI Cards
  totalUtilisateurs: number = 0;
  nbEtudiants: number = 0;
  nbProprietaires: number = 0;
  nbAnnoncesPubliees: number = 0;
  totalDemandes: number = 0;
  nbVerificationsEnAttente: number = 0;

  // 2. Bloc 'À traiter' (5 plus anciennes vérifications et 5 plus anciennes annonces en attente)
  verificationsATraiter: VerificationAvecAuteur[] = [];
  annoncesATraiter: Annonce[] = [];

  // 3. Bloc 'Annonces par statut' avec barres horizontales
  statsAnnonces: StatutAnnonceStats[] = [];

  // 4. Bloc 'Dernières inscriptions' (8 derniers utilisateurs)
  dernieresInscriptions: User[] = [];

  ngOnInit(): void {
    this.chargerDonnees();
  }

  // Charge l'ensemble des données réelles depuis Firestore via les services
  async chargerDonnees(): Promise<void> {
    this.chargement = true;
    this.erreur = null;

    try {
      const [users, annonces, demandes, verifs] = await Promise.all([
        this.userService.getAllUsers(),
        this.annonceService.getAllAnnonces(),
        this.demandeService.getAllDemandes(),
        this.verificationService.getEnAttente()
      ]);

      // Calcul des 4 KPI
      this.totalUtilisateurs = users.length;
      this.nbEtudiants = users.filter(u => u.role === 'etudiant').length;
      this.nbProprietaires = users.filter(u => u.role === 'proprietaire').length;
      this.nbAnnoncesPubliees = annonces.filter(a => a.statut === 'publiee').length;
      this.totalDemandes = demandes.length;
      this.nbVerificationsEnAttente = verifs.length;

      // Index des utilisateurs par UID pour enrichir les vérifications
      const mapUsers = new Map<string, User>();
      users.forEach(u => {
        if (u.uid) mapUsers.set(u.uid, u);
      });

      // Bloc 'À traiter' : les 5 plus anciennes vérifications (tri ascendant dateDepot)
      const verifsTriees = [...verifs].sort((a, b) =>
        (a.dateDepot || '').localeCompare(b.dateDepot || '')
      );
      this.verificationsATraiter = verifsTriees.slice(0, 5).map(v => {
        const u = mapUsers.get(v.userId);
        return {
          ...v,
          userNom: u?.nom || 'Utilisateur inconnu',
          userEmail: u?.email || '',
          userRole: u?.role || 'etudiant'
        };
      });

      // Bloc 'À traiter' : les 5 plus anciennes annonces en attente
      const annoncesEnAttente = annonces
        .filter(a => a.statut === 'en_attente')
        .sort((a, b) => (a.dateCreation || '').localeCompare(b.dateCreation || ''));
      this.annoncesATraiter = annoncesEnAttente.slice(0, 5);

      // Bloc 'Annonces par statut'
      const totalAnnonces = annonces.length;
      const statutsConfig = [
        { statut: 'publiee', libelle: 'Publiées', couleurClass: 'barre-ok' },
        { statut: 'en_attente', libelle: 'En attente de validation', couleurClass: 'barre-sun' },
        { statut: 'suspendue', libelle: 'Suspendues', couleurClass: 'barre-warn' },
        { statut: 'refusee', libelle: 'Refusées', couleurClass: 'barre-danger' }
      ];

      this.statsAnnonces = statutsConfig.map(cfg => {
        const count = annonces.filter(a => a.statut === cfg.statut).length;
        const pourcentage = totalAnnonces > 0 ? Math.round((count / totalAnnonces) * 100) : 0;
        return {
          statut: cfg.statut,
          libelle: cfg.libelle,
          count,
          pourcentage,
          couleurClass: cfg.couleurClass
        };
      });

      // Bloc 'Dernières inscriptions' : les 8 derniers inscrits
      this.dernieresInscriptions = [...users]
        .sort((a, b) => (b.dateInscription || '').localeCompare(a.dateInscription || ''))
        .slice(0, 8);

    } catch (err) {
      console.error('Erreur lors du chargement des statistiques du tableau de bord :', err);
      this.erreur = 'Impossible de charger les données du tableau de bord.';
    } finally {
      this.chargement = false;
    }
  }

  // Formate une chaîne de date ISO en format lisible en français
  formaterDate(iso?: string): string {
    if (!iso) return 'Date inconnue';
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat('fr-TN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return iso;
    }
  }
}
