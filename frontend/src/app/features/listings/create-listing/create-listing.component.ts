// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { Web3Service } from '../../../core/services/web3.service';
import { HARDWARE_CATEGORIES, HardwareCategory } from '../../../core/models/category.model';
import { ProofOfListingChallenge, CreateListingPayload } from '../../../core/models/listing.model';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { keccak256, encodePacked } from 'viem';

@Component({
  selector: 'ayni-create-listing',
  standalone: true,
  imports: [
    FormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    UsdtPipe,
  ],
  templateUrl: './create-listing.component.html',
  styleUrl: './create-listing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateListingComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly catalogService = inject(CatalogService);
  protected readonly authService = inject(AuthService);
  protected readonly web3Service = inject(Web3Service);

  public readonly currentStep = signal<1 | 2 | 3>(1);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly isChallengeLoading = signal<boolean>(false);
  public readonly isAiAnalyzing = signal<boolean>(false);
  public readonly aiVerdict = signal<'PASS' | 'WARN' | 'FAIL' | null>(null);

  // Form Fields
  public readonly category = signal<HardwareCategory>('SMARTPHONE');
  public readonly title = signal<string>('');
  public readonly description = signal<string>('');
  public readonly priceUsdt = signal<number>(500);
  public readonly declaredCondition = signal<number>(9);
  public readonly ram = signal<string>('8 GB');
  public readonly storage = signal<string>('256 GB');
  public readonly batteryHealth = signal<string>('92%');
  public readonly hardwareIdentifier = signal<string>('358920194820194'); // Private input
  public readonly selectedFileName = signal<string | null>(null);

  // Challenge State
  public readonly challenge = signal<ProofOfListingChallenge | null>(null);
  public readonly salt = signal<string>('');

  public readonly categories = HARDWARE_CATEGORIES;

  // Salted commitment: keccak256(abi.encodePacked(imei, salt, seller))
  public readonly computedProofHash = computed<string>(() => {
    const imei = this.hardwareIdentifier().trim();
    const currentSalt = this.salt();
    const seller = this.authService.walletAddress() || '0x0000000000000000000000000000000000000000';

    if (!imei || !currentSalt) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    try {
      return keccak256(
        encodePacked(
          ['string', 'string', 'address'],
          [imei, currentSalt, seller as `0x${string}`]
        )
      );
    } catch {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
  });

  public ngOnInit(): void {
    // Generate an initial random 32-byte salt
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const hexSalt = '0x' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    this.salt.set(hexSalt);
  }

  public async goToStep2(): Promise<void> {
    if (!this.title().trim() || !this.description().trim() || this.priceUsdt() <= 0) {
      alert('Por favor completa todos los campos de hardware y precio.');
      return;
    }

    this.currentStep.set(2);
    this.isChallengeLoading.set(true);

    try {
      const ch = await this.catalogService.getProofOfListingChallenge();
      this.challenge.set(ch);
    } catch (err) {
      console.error('Failed to get POL challenge', err);
    } finally {
      this.isChallengeLoading.set(false);
    }
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFileName.set(input.files[0].name);
      // Simulate AI validation process
      this.runAiVerification();
    }
  }

  private runAiVerification(): void {
    this.isAiAnalyzing.set(true);
    this.aiVerdict.set(null);

    setTimeout(() => {
      this.isAiAnalyzing.set(false);
      this.aiVerdict.set('PASS');
    }, 1800);
  }

  public goToStep3(): void {
    if (this.aiVerdict() !== 'PASS') {
      alert('Debes subir la prueba física y obtener el dictamen de IA antes de continuar.');
      return;
    }
    this.currentStep.set(3);
  }

  public async publishListing(): Promise<void> {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);

    try {
      const payload: CreateListingPayload = {
        sellerAddress: this.authService.walletAddress() || '0x71C...4d9',
        title: this.title(),
        description: this.description(),
        category: this.category(),
        priceUsdt: this.priceUsdt(),
        declaredCondition: this.declaredCondition(),
        proofHash: this.computedProofHash(),
        commitmentSalt: this.salt(),
        hardwareIdentifier: this.hardwareIdentifier(),
        checklist: {
          ram: this.ram(),
          storage: this.storage(),
          batteryHealth: this.batteryHealth(),
          screenCondition: 'Impecable',
          portsWorking: true,
        },
      };

      const res = await this.catalogService.createListing(payload);
      const newId = res.listing?.id || '11111111-1111-1111-1111-111111111111';
      alert(`¡Dispositivo publicado exitosamente en HSK Chain! ID: ${newId}`);
      this.router.navigate(['/catalog', newId]);
    } catch (err) {
      console.error('Error creating listing', err);
      alert('Error al publicar el dispositivo. Intenta nuevamente.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
