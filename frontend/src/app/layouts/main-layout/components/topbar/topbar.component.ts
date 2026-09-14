// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { Web3Service } from '../../../../core/services/web3.service';
import { KycService } from '../../../../core/services/kyc.service';
import { UserModeService } from '../../../../core/services/user-mode.service';
import { TruncateAddressPipe } from '../../../../shared/pipes/truncate-address.pipe';
import { UsdtPipe } from '../../../../shared/pipes/usdt.pipe';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AguayoRibbonComponent } from '../../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';
import { KycBridgeModalComponent } from '../../../../shared/components/kyc-bridge-modal/kyc-bridge-modal.component';

@Component({
  selector: 'ayni-topbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TruncateAddressPipe,
    UsdtPipe,
    BadgeComponent,
    ButtonComponent,
    AguayoRibbonComponent,
    KycBridgeModalComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly web3Service = inject(Web3Service);
  protected readonly kycService = inject(KycService);
  protected readonly userModeService = inject(UserModeService);

  public readonly isMenuOpen = signal<boolean>(false);
  public readonly isDropdownOpen = signal<boolean>(false);
  public readonly isConnecting = signal<boolean>(false);

  public async ngOnInit(): Promise<void> {
    if (this.authService.walletAddress()) {
      await this.kycService.fetchUserProfile();
    }
  }

  public toggleMenu(): void {
    this.isMenuOpen.update((v) => !v);
  }

  public closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  public toggleDropdown(): void {
    this.isDropdownOpen.update((v) => !v);
  }

  public closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  public async onConnect(): Promise<void> {
    if (this.isConnecting()) return;
    this.isConnecting.set(true);
    try {
      await this.authService.connectAndAuthenticate();
      await this.kycService.fetchUserProfile();
    } catch (err) {
      console.error('Connection failed', err);
    } finally {
      this.isConnecting.set(false);
    }
  }

  public async onVerifyKyc(): Promise<void> {
    try {
      await this.kycService.startVerificationFlow();
    } catch (err) {
      console.error('KYC verification error', err);
    }
  }

  public async onSwitchRole(role: 'Buyer' | 'Seller'): Promise<void> {
    await this.kycService.switchRole(role);
    this.closeDropdown();
  }

  public onOpenAccountModal(): void {
    this.web3Service.openAccountModal();
    this.closeDropdown();
  }

  public onDisconnect(): void {
    this.authService.disconnect();
    this.closeDropdown();
  }
}

