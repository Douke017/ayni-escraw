// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { type Address } from 'viem';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatBondService } from '../../core/services/chat-bond.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Web3Service } from '../../core/services/web3.service';
import { ProductListing } from '../../core/models/listing.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { TruncateAddressPipe } from '../../shared/pipes/truncate-address.pipe';
import { UsdtPipe } from '../../shared/pipes/usdt.pipe';
import { SellerAgentService } from '../../core/services/seller-agent.service';
import { environment } from '../../../environments/environment';

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
    UsdtPipe,
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
  protected readonly catalogService = inject(CatalogService);
  protected readonly web3Service = inject(Web3Service);
  protected readonly sellerAgentService = inject(SellerAgentService);

  public readonly orderId = signal<string>('');
  public readonly listing = signal<ProductListing | null>(null);
  public readonly messageInput = signal<string>('');
  public readonly isBondDeposited = signal<boolean>(false);
  public readonly isDepositingBond = signal<boolean>(false);
  public readonly isClaimingRefund = signal<boolean>(false);

  // Autonomous Seller Agent state
  public readonly isAgentEnabled = signal<boolean>(true);
  public readonly isAgentResponding = signal<boolean>(false);
  public readonly lastAgentAction = signal<string | null>(null);

  // Determine if connected user is the seller of this listing
  public readonly isSeller = computed(() => {
    const myAddr = (this.authService.walletAddress() || this.web3Service.account())?.toLowerCase();
    const sellerAddr = this.listing()?.sellerAddress?.toLowerCase();
    return !!myAddr && !!sellerAddr && myAddr === sellerAddr;
  });

  // Bond is satisfied if deposited OR if user is the seller
  public readonly isBondSatisfied = computed(() => {
    return this.isBondDeposited() || this.isSeller();
  });

  // Filter messages for current conversation
  public readonly currentChatMessages = computed(() => {
    return this.signalR.chatMessages().filter((m) => m.orderId === this.orderId());
  });

  public readonly hskRegistryUrl = computed(() => {
    return (
      this.sellerAgentService.hskInfo()?.agentRegistryUrl ||
      'https://testnet-explorer.hskchain.net/address/0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2'
    );
  });

  public readonly quickOfferPrice90 = computed(() => {
    const p = this.listing()?.priceUsdt;
    return p ? Math.round(p * 0.9) : 0;
  });

  public readonly quickOfferPrice95 = computed(() => {
    const p = this.listing()?.priceUsdt;
    return p ? Math.round(p * 0.95) : 0;
  });

  public readonly parsedSpecs = computed<Record<string, unknown>>(() => {
    const json = this.listing()?.technicalAttributesJson;
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  });

  public readonly specEntries = computed<{ key: string; value: string }[]>(() => {
    const specs = this.parsedSpecs();
    return Object.entries(specs).map(([key, val]) => ({ key, value: String(val) }));
  });

  public ngOnInit(): void {
    this.sellerAgentService.getHskInfo();

    const queryOrderId =
      this.route.snapshot.queryParamMap.get('listingId') ||
      this.route.snapshot.paramMap.get('orderId');

    if (queryOrderId) {
      this.orderId.set(queryOrderId);
      this.loadListingAndChat(queryOrderId);
    } else {
      // Direct navigation to /chat without queryParams: pick first listing or load
      const currentListings = this.catalogService.listings();
      if (currentListings.length > 0) {
        this.orderId.set(currentListings[0].id);
        this.loadListingAndChat(currentListings[0].id);
      } else {
        this.catalogService.fetchListings().then(() => {
          const first = this.catalogService.listings()[0];
          if (first) {
            this.orderId.set(first.id);
            this.loadListingAndChat(first.id);
          }
        });
      }
    }
  }

  public selectConversation(listingId: string): void {
    if (this.orderId()) {
      this.signalR.leaveChat(this.orderId());
    }
    this.orderId.set(listingId);
    this.loadListingAndChat(listingId);
  }

  private loadListingAndChat(id: string): void {
    // 1. Resolve listing details
    const found = this.catalogService.listings().find((l) => l.id === id);
    if (found) {
      this.listing.set(found);
    } else {
      this.catalogService.fetchListings().then(() => {
        const item = this.catalogService.listings().find((l) => l.id === id);
        if (item) this.listing.set(item);
      });
    }

    // 2. Connect SignalR Hub & Join Group
    this.signalR.connectChatHub();
    this.signalR.joinChat(id);

    // 3. Load historical messages from backend
    this.bondService.fetchMessages(id).then((history) => {
      if (history && history.length > 0) {
        this.signalR.setChatHistory(id, history);
      }
    });

    // 4. Check on-chain / off-chain bond status
    this.bondService.fetchBondStatus(id).then((status) => {
      if (
        status &&
        (status.status === 'Active' ||
          status.status === 'RefundEligible' ||
          status.status === 'Refunded')
      ) {
        this.isBondDeposited.set(true);
      }
    });
  }

  public ngOnDestroy(): void {
    if (this.orderId()) {
      this.signalR.leaveChat(this.orderId());
    }
  }

  public async onSendMessage(): Promise<void> {
    const text = this.messageInput().trim();
    if (!text || !this.orderId()) return;

    if (!this.isBondSatisfied()) {
      alert('Debes depositar el Bono de Intención de 0.30 USDT para habilitar el envío de mensajes.');
      return;
    }

    let sender = this.authService.walletAddress() || this.web3Service.account();
    if (!sender) {
      const ok = await this.authService.connectAndAuthenticate();
      if (!ok) {
        alert('Debes conectar tu billetera para participar en el chat.');
        return;
      }
      sender = this.authService.walletAddress() || this.web3Service.account();
    }

    await this.signalR.sendMessage(this.orderId(), sender!, text);
    this.messageInput.set('');

    // Fetch updated bond replies & register reply in backend
    try {
      await this.bondService.recordReply(this.orderId(), sender!, text);
      await this.bondService.fetchBondStatus(this.orderId());
    } catch (e) {
      console.warn('Could not record reply metadata in backend:', e);
    }

    // Trigger Autonomous Seller Agent reply if buyer is chatting
    if (!this.isSeller() && this.isAgentEnabled()) {
      this.isAgentResponding.set(true);
      try {
        const replyRes = await this.sellerAgentService.getChatReply(
          this.orderId(),
          text,
          sender!
        );
        this.lastAgentAction.set(replyRes.action);
        await this.bondService.fetchBondStatus(this.orderId());
      } catch (err) {
        console.warn('Seller agent auto-reply failed:', err);
      } finally {
        this.isAgentResponding.set(false);
      }
    }
  }

  public async onDepositBond(): Promise<void> {
    const id = this.orderId();
    if (!id) {
      alert('No hay una publicación seleccionada.');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      const ok = await this.authService.connectAndAuthenticate();
      if (!ok) return;
    }

    const buyer = (this.authService.walletAddress() || this.web3Service.account()) as Address;
    const seller = (this.listing()?.sellerAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Address;

    if (buyer.toLowerCase() === seller.toLowerCase()) {
      alert('Eres el vendedor de esta publicación. El bono de intención lo abona el comprador interesado.');
      this.isBondDeposited.set(true);
      return;
    }

    const currentBal = parseFloat(this.web3Service.balanceUsdt());
    if (currentBal < 0.3) {
      alert(`Saldo USDT insuficiente (${currentBal} USDT). Requieres al menos 0.30 USDT para el Bono Anti-Spam.`);
      return;
    }

    this.isDepositingBond.set(true);
    try {
      let txHash = '';
      const chatBondContract = environment.contracts.chatBond as Address;

      if (chatBondContract && environment.contracts.usdt) {
        // 1. Approve 0.30 USDT (300,000 units with 6 decimals) to AyniChatBond
        const bondAmountUnits = 300_000n;
        await this.web3Service.ensureUsdtAllowance(chatBondContract, bondAmountUnits);

        // 2. Execute on-chain openChatBond
        txHash = await this.web3Service.depositChatBondOnChain(id, seller);
      }

      // 3. Record deposit in Backend DB
      await this.bondService.depositBond({
        orderId: id,
        buyerAddress: buyer,
        sellerAddress: seller,
        amountUsdt: 0.3,
        depositTxHash: txHash || undefined,
      });

      this.isBondDeposited.set(true);
      await this.bondService.fetchBondStatus(id);

      // System notification
      this.signalR.addSimulatedMessage({
        orderId: id,
        senderAddress: '0x0000000000000000000000000000000000000042',
        encryptedPayload:
          '[Ayni Guard] Bono de Intención de 0.30 USDT depositado con éxito en AyniChatBond.sol. El reembolso total (100%) estará disponible automáticamente tras 2 respuestas mutuas.',
        timestamp: Date.now(),
      });

      alert('¡Bono de intención de 0.30 USDT depositado con éxito! Canal de chat activado.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al depositar Intent Bond.';
      console.error('Chat bond deposit failed:', err);
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
