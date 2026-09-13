// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../../core/services/catalog.service';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { Web3Service } from '../../../core/services/web3.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductListing } from '../../../core/models/listing.model';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../../shared/pipes/truncate-address.pipe';

@Component({
  selector: 'ayni-checkout',
  standalone: true,
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    UsdtPipe,
    TruncateAddressPipe,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly catalogService = inject(CatalogService);
  protected readonly escrowService = inject(EscrowStateService);
  protected readonly web3Service = inject(Web3Service);
  protected readonly authService = inject(AuthService);

  public readonly listing = signal<ProductListing | null>(null);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly isSuccess = signal<boolean>(false);
  public readonly createdOrderId = signal<string | null>(null);

  public ngOnInit(): void {
    const listingId = this.route.snapshot.queryParamMap.get('listingId');
    if (listingId) {
      const found = this.catalogService.listings().find((l) => l.id === listingId);
      if (found) {
        this.listing.set(found);
      } else {
        this.catalogService.fetchListings().then(() => {
          const item = this.catalogService.listings().find((l) => l.id === listingId);
          this.listing.set(item || null);
        });
      }
    }
  }

  public async onDepositWithPermit2(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      await this.authService.connectAndAuthenticate();
      if (!this.authService.isAuthenticated()) return;
    }

    const item = this.listing();
    if (!item) return;

    this.isSubmitting.set(true);
    try {
      // Mock or sign typed data for Permit2
      const orderId = `order_${Date.now()}`;
      const permitSignature = '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c';

      await this.escrowService.depositPermit2(orderId, item.priceUsdt, permitSignature);

      this.createdOrderId.set(orderId);
      this.isSuccess.set(true);
    } catch (err) {
      console.error('Permit2 deposit failed', err);
      alert('Error en la firma del depósito Permit2. Verifica tu saldo en USDT.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public goToSafeMeet(): void {
    const id = this.createdOrderId() || 'order_active_1';
    this.router.navigate(['/escrow/safe-meet', id]);
  }
}
