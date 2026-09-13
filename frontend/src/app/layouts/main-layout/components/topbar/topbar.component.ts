// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { Web3Service } from '../../../../core/services/web3.service';
import { TruncateAddressPipe } from '../../../../shared/pipes/truncate-address.pipe';
import { UsdtPipe } from '../../../../shared/pipes/usdt.pipe';
import { AguayoRibbonComponent } from '../../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'ayni-topbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TruncateAddressPipe,
    UsdtPipe,
    AguayoRibbonComponent,
    BadgeComponent,
    ButtonComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  protected readonly authService = inject(AuthService);
  protected readonly web3Service = inject(Web3Service);

  public readonly isMenuOpen = signal<boolean>(false);
  public readonly isDropdownOpen = signal<boolean>(false);
  public readonly isConnecting = signal<boolean>(false);

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
    } catch (err) {
      console.error('Connection failed', err);
    } finally {
      this.isConnecting.set(false);
    }
  }

  public onDisconnect(): void {
    this.authService.disconnect();
    this.closeDropdown();
  }

  public async onAddUsdtToMetaMask(): Promise<void> {
    await this.web3Service.addUsdtToMetaMask();
    this.closeDropdown();
  }

  public async onRequestFaucet(): Promise<void> {
    try {
      await this.web3Service.requestFaucet(1000);
      alert('¡Solicitud de Faucet enviada! En unos segundos tendrás 1,000 USDT adicionales.');
    } catch (err) {
      alert('No se pudo completar el reclamo del faucet.');
    }
    this.closeDropdown();
  }

  public async onRefreshBalance(): Promise<void> {
    await this.web3Service.refreshUsdtBalance();
    this.closeDropdown();
  }
}
