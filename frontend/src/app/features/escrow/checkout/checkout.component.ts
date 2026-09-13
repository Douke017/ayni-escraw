// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type Address } from 'viem';
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
import { environment } from '../../../../environments/environment';

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
  public readonly errorMessage = signal<string | null>(null);

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
    this.errorMessage.set(null);

    try {
      const buyer = (this.authService.walletAddress() || this.web3Service.account()) as Address;
      const seller = item.sellerAddress as Address;

      // 1. Create order in Backend / DB
      const order = await this.escrowService.createOrder(
        item.id,
        buyer,
        seller,
        item.priceUsdt,
        42
      );

      // 2. Sign real EIP-712 Permit2 typed data if Web3 provider and contracts are present
      let permitSignature = '';
      if (environment.contracts.usdt && environment.contracts.escrow) {
        const nonce = BigInt(Date.now());
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const onChainIdNum = order.onChainOrderId.startsWith('0x')
          ? BigInt(order.onChainOrderId)
          : BigInt(1);

        permitSignature = await this.web3Service.signPermit2Witness({
          token: environment.contracts.usdt as Address,
          spender: environment.contracts.escrow as Address,
          amount: BigInt(Math.round(item.priceUsdt * 1e6)),
          nonce,
          deadline,
          orderId: onChainIdNum,
          buyer,
          seller,
        });
      }

      // 3. Register deposit with Permit2 signature
      await this.escrowService.depositPermit2(order.id, item.priceUsdt, permitSignature);

      this.createdOrderId.set(order.id);
      this.isSuccess.set(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la firma del depósito Permit2';
      this.errorMessage.set(msg);
      console.error('Permit2 deposit failed', err);
      alert(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public goToSafeMeet(): void {
    const id = this.createdOrderId();
    if (id) {
      this.router.navigate(['/escrow/safe-meet', id]);
    }
  }
}
