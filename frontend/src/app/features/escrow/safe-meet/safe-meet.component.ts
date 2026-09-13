// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth.service';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { CountdownTimerComponent } from '../../../shared/components/countdown-timer/countdown-timer.component';
import { QrCodeComponent } from '../../../shared/components/qr-code/qr-code.component';

@Component({
  selector: 'ayni-safe-meet',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
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

  public readonly orderId = signal<string>('order_active_1');
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

    // Connect to SignalR EscrowHub and join group
    this.signalR.connectEscrowHub();
    this.signalR.joinEscrowOrder(this.orderId());

    // Initialize QR generation for seller mode
    this.generateNewQr();
  }

  public ngOnDestroy(): void {
    this.signalR.leaveEscrowOrder(this.orderId());
  }

  public generateNewQr(): void {
    this.escrowService.generateSafeMeetQr(this.orderId());
  }

  public setMode(mode: 'seller' | 'buyer'): void {
    this.activeMode.set(mode);
  }

  public async onValidateQr(): Promise<void> {
    const secret = this.manualSecretInput().trim();
    if (!secret) return;

    this.isValidating.set(true);
    this.validationMessage.set(null);

    try {
      const res = await this.escrowService.validateSafeMeetQr(this.orderId(), secret);
      if (res.success) {
        this.handoffConfirmed.set(true);
        this.validationMessage.set('✓ ¡Código verificado en Redis! Entrega confirmada y fondos liberados.');
      } else {
        this.validationMessage.set('⚠️ Código inválido o expirado. Solicita al vendedor generar un nuevo QR.');
      }
    } catch {
      this.validationMessage.set('⚠️ Error en la verificación del código.');
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
