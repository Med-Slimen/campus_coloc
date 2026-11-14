import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { VerificationBannerComponent } from '../../components/verification-banner/verification-banner.component';

@Component({
  selector: 'app-membre-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent, VerificationBannerComponent],
  templateUrl: './membre-layout.component.html',
  styleUrls: ['./membre-layout.component.css']
})
export class MembreLayoutComponent {
  // Gabarit réservé aux membres connectés (avec bandeau de vérification conditionnel)
}

