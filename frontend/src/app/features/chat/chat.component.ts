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

  public readonly orderId = signal<string>('chat_hardware_101');
  public readonly messageInput = signal<string>('');
  public readonly isBondDeposited = signal<boolean>(true);
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

    // Connect to SignalR ChatHub
    this.signalR.connectChatHub();
    this.signalR.joinChat(this.orderId());
    this.bondService.fetchBondStatus(this.orderId());

    // Seed mock initial greeting if empty
    if (this.currentChatMessages().length === 0) {
      this.seedInitialMessages();
    }
  }

  public ngOnDestroy(): void {
    this.signalR.leaveChat(this.orderId());
  }

  private seedInitialMessages(): void {
    const initial = [
      {
        id: 'msg_1',
        orderId: this.orderId(),
        senderAddress: '0x3A219800000000000000000000000000000091eA',
        messageText: '¡Hola! Vi que te interesa el dispositivo. El hardware está verificado con PASS y el IMEI está protegido con hash salted.',
        sentAtUtc: new Date(Date.now() - 300000).toISOString(),
        isAiAgent: false,
      },
      {
        id: 'msg_2',
        orderId: this.orderId(),
        senderAddress: '0x0000000000000000000000000000000000000042',
        messageText: '🤖 [Ayni Agent]: Verificación de especificaciones completada. Batería al 92% y pantalla original sin reparaciones previas.',
        sentAtUtc: new Date(Date.now() - 240000).toISOString(),
        isAiAgent: true,
      },
    ];

    this.signalR.chatMessages.set(initial);
  }

  public async onSendMessage(): Promise<void> {
    const text = this.messageInput().trim();
    if (!text) return;

    const sender = this.authService.walletAddress() || '0x71C8000000000000000000000000000000004d9B';
    await this.signalR.sendMessage(this.orderId(), sender, text);
    this.messageInput.set('');

    // If less than 2 replies, increment locally for UX feedback
    const currentStatus = this.bondService.bondStatus();
    if (currentStatus && currentStatus.buyerReplies < 2) {
      this.bondService.bondStatus.set({
        ...currentStatus,
        buyerReplies: currentStatus.buyerReplies + 1,
        isRefundEligible: currentStatus.buyerReplies + 1 >= 2 && currentStatus.sellerReplies >= 2,
      });
    }
  }

  public async onDepositBond(): Promise<void> {
    this.isDepositingBond.set(true);
    try {
      await this.bondService.depositBond(this.orderId(), 0.3);
      this.isBondDeposited.set(true);
    } catch {
      alert('Error al depositar Intent Bond.');
    } finally {
      this.isDepositingBond.set(false);
    }
  }

  public async onClaimRefund(): Promise<void> {
    this.isClaimingRefund.set(true);
    try {
      await this.bondService.claimRefund(this.orderId());
      alert('¡Reembolso de 0.30 USDT devuelto exitosamente a tu billetera!');
    } catch {
      alert('Error al solicitar reembolso.');
    } finally {
      this.isClaimingRefund.set(false);
    }
  }

  public applyQuickSuggestion(text: string): void {
    this.messageInput.set(text);
  }
}
