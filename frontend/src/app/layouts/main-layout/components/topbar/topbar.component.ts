// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { Web3Service } from '../../../../core/services/web3.service';
import { TruncateAddressPipe } from '../../../../shared/pipes/truncate-address.pipe';
import { UsdtPipe } from '../../../../shared/pipes/usdt.pipe';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AguayoRibbonComponent } from '../../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';

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
}
