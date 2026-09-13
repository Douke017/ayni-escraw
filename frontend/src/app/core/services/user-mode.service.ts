// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { KycService } from './kyc.service';
import { Web3Service } from './web3.service';
import { AuthService } from './auth.service';

export type UserMode = 'Buyer' | 'Seller';

@Injectable({
  providedIn: 'root',
})
export class UserModeService {
  private readonly kycService = inject(KycService);
  private readonly web3Service = inject(Web3Service);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly STORAGE_KEY = 'ayni_user_mode';

  public readonly currentMode = signal<UserMode>(
    (localStorage.getItem(this.STORAGE_KEY) as UserMode) || 'Buyer'
  );

  public readonly isKycModalOpen = signal<boolean>(false);

  public readonly isSellerMode = computed(() => this.currentMode() === 'Seller');
  public readonly isBuyerMode = computed(() => this.currentMode() === 'Buyer');

  public readonly isWalletConnected = computed(
    () => this.web3Service.isConnected() || this.authService.isAuthenticated()
  );

  public readonly isKycApproved = computed(() => this.kycService.isApproved());

  /**
   * Request to enter Seller Mode.
   * If wallet is not connected -> triggers connection.
   * If wallet is connected but KYC not approved -> opens KYC Bridge Modal.
   * If KYC is approved -> switches to Seller Mode immediately.
   */
  public async requestSellerMode(targetRoute?: string): Promise<boolean> {
    if (!this.isWalletConnected()) {
      try {
        await this.web3Service.connectWallet();
      } catch (err) {
        console.warn('Wallet connection dismissed or failed:', err);
      }
      if (!this.isWalletConnected()) {
        return false;
      }
    }

    // Check KYC status
    if (!this.kycService.isApproved()) {
      // Re-fetch profile just in case status was updated
      await this.kycService.fetchUserProfile();
    }

    if (!this.kycService.isApproved()) {
      // Wallet connected but not KYC verified: open bridge modal
      this.isKycModalOpen.set(true);
      return false;
    }

    // KYC is approved! Activate Seller Mode
    this.currentMode.set('Seller');
    localStorage.setItem(this.STORAGE_KEY, 'Seller');
    await this.kycService.switchRole('Seller');

    if (targetRoute) {
      this.router.navigate([targetRoute]);
    }
    return true;
  }

  public async switchToBuyerMode(targetRoute?: string): Promise<void> {
    this.currentMode.set('Buyer');
    localStorage.setItem(this.STORAGE_KEY, 'Buyer');
    await this.kycService.switchRole('Buyer');
    if (targetRoute) {
      this.router.navigate([targetRoute]);
    }
  }

  public openKycModal(): void {
    this.isKycModalOpen.set(true);
  }

  public closeKycModal(): void {
    this.isKycModalOpen.set(false);
  }
}
