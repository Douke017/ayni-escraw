import { CommonModule } from '@angular/common';
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth.service';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CountdownTimerComponent } from '../../../shared/components/countdown-timer/countdown-timer.component';
import { QrCodeComponent } from '../../../shared/components/qr-code/qr-code.component';

@Component({
  selector: 'ayni-safe-meet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
CountdownTimerComponent,
    QrCodeComponent,
  ],
  templateUrl: './safe-meet.component.html',
  styleUrl: './safe-meet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SafeMeetComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly escrowService = inject(EscrowStateService);
  protected readonly signalR = inject(SignalRService);
  protected readonly authService = inject(AuthService);

  public readonly orderId = signal<string>('');
  public readonly activeMode = signal<'seller' | 'buyer'>('seller');
  public readonly manualSecretInput = signal<string>('');
  public readonly isValidating = signal<boolean>(false);
  public readonly validationMessage = signal<string | null>(null);
  public readonly handoffConfirmed = signal<boolean>(false);

  constructor() {
    // Listen to real-time SignalR handoff confirmation
    effect(() => {
      const liveOrders = this.signalR.escrowOrders();
      const current = liveOrders.find((o) => o.orderId === this.orderId());
      if (current && (current.status === 2 || current.status === 3 || current.status === 4)) {
        this.handoffConfirmed.set(true);
      }
    });
  }

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('orderId');
    if (id) {
      this.orderId.set(id);
    }

    if (this.orderId()) {
      // Connect to SignalR EscrowHub and join group
      this.signalR.connectEscrowHub();
      this.signalR.joinEscrowOrder(this.orderId());

      // Initialize QR generation for seller mode
      this.generateNewQr();
    }
  }

  public ngOnDestroy(): void {
    if (this.orderId()) {
      this.signalR.leaveEscrowOrder(this.orderId());
    }
  }

  public generateNewQr(): void {
    if (this.orderId()) {
      this.escrowService.generateSafeMeetQr(this.orderId());
    }
  }

  public setMode(mode: 'seller' | 'buyer'): void {
    this.activeMode.set(mode);
  }

  public async onValidateQr(): Promise<void> {
    const secret = this.manualSecretInput().trim();
    if (!secret || !this.orderId()) return;

    let buyer = this.authService.walletAddress();
    if (!buyer) {
      const ok = await this.authService.connectAndAuthenticate();
      if (!ok) {
        alert('Debes conectar tu billetera de comprador para validar el código QR.');
        return;
      }
      buyer = this.authService.walletAddress();
    }

    this.isValidating.set(true);
    this.validationMessage.set(null);

    try {
      const res = await this.escrowService.validateSafeMeetQr(this.orderId(), secret, buyer!);
      if (res.success) {
        this.handoffConfirmed.set(true);
        this.validationMessage.set('✓ ¡Código verificado en Redis! Entrega física confirmada en HSK.');
      } else {
        this.validationMessage.set('⚠️ Código inválido o expirado. Solicita al vendedor generar un nuevo QR.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la verificación del código.';
      this.validationMessage.set(`⚠️ ${msg}`);
    } finally {
      this.isValidating.set(false);
    }
  }

  public simulateBuyerScan(): void {
    const currentNonce = this.escrowService.safeMeetQr()?.nonce;
    if (currentNonce) {
      this.manualSecretInput.set(currentNonce);
      this.onValidateQr();
    }
  }
}
