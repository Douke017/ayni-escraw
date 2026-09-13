// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatBondService } from '../../core/services/chat-bond.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { TruncateAddressPipe } from '../../shared/pipes/truncate-address.pipe';

@Component({
  selector: 'ayni-chat',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    TruncateAddressPipe,
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly signalR = inject(SignalRService);
  protected readonly bondService = inject(ChatBondService);
  protected readonly authService = inject(AuthService);

  public readonly orderId = signal<string>('');
  public readonly messageInput = signal<string>('');
  public readonly isBondDeposited = signal<boolean>(false);
  public readonly isDepositingBond = signal<boolean>(false);
  public readonly isClaimingRefund = signal<boolean>(false);

  // Filter messages for current conversation
  public readonly currentChatMessages = computed(() => {
    return this.signalR.chatMessages().filter((m) => m.orderId === this.orderId());
  });

  public ngOnInit(): void {
    const queryOrderId = this.route.snapshot.queryParamMap.get('listingId') || this.route.snapshot.paramMap.get('orderId');
    if (queryOrderId) {
      this.orderId.set(queryOrderId);
    }

    if (this.orderId()) {
      // Connect to SignalR ChatHub
      this.signalR.connectChatHub();
      this.signalR.joinChat(this.orderId());
      this.bondService.fetchBondStatus(this.orderId()).then((status) => {
        if (status) {
          this.isBondDeposited.set(true);
        }
      });
    }
  }

  public ngOnDestroy(): void {
    if (this.orderId()) {
      this.signalR.leaveChat(this.orderId());
    }
  }

  public async onSendMessage(): Promise<void> {
    const text = this.messageInput().trim();
    if (!text || !this.orderId()) return;

    let sender = this.authService.walletAddress();
    if (!sender) {
      const ok = await this.authService.connectAndAuthenticate();
      if (!ok) {
        alert('Debes conectar tu billetera para participar en el chat.');
        return;
      }
      sender = this.authService.walletAddress();
    }

    await this.signalR.sendMessage(this.orderId(), sender!, text);
    this.messageInput.set('');

    // Fetch updated bond replies
    await this.bondService.fetchBondStatus(this.orderId());
  }

  public async onDepositBond(): Promise<void> {
    if (!this.orderId()) return;
    this.isDepositingBond.set(true);
    try {
      await this.bondService.depositBond(this.orderId(), 0.3);
      this.isBondDeposited.set(true);
      await this.bondService.fetchBondStatus(this.orderId());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al depositar Intent Bond.';
      alert(msg);
    } finally {
      this.isDepositingBond.set(false);
    }
  }

  public async onClaimRefund(): Promise<void> {
    if (!this.orderId()) return;
    this.isClaimingRefund.set(true);
    try {
      await this.bondService.claimRefund(this.orderId());
      alert('¡Reembolso de 0.30 USDT devuelto exitosamente a tu billetera!');
      await this.bondService.fetchBondStatus(this.orderId());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar reembolso.';
      alert(msg);
    } finally {
      this.isClaimingRefund.set(false);
    }
  }

  public applyQuickSuggestion(text: string): void {
    this.messageInput.set(text);
  }
}
