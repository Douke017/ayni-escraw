import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatBondStatusResponse } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatBondService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api';

  // Vanilla Signals
  public readonly bondStatus = signal<ChatBondStatusResponse | null>(null);
  public readonly isRefundEligible = signal<boolean>(false);
  public readonly buyerReplies = signal<number>(0);
  public readonly sellerReplies = signal<number>(0);

  // Computed helper signals
  public readonly buyerRepliesCount = computed(() => this.buyerReplies());
  public readonly sellerRepliesCount = computed(() => this.sellerReplies());
  public readonly progressPercentage = computed(() =>
    Math.min(100, Math.round(((this.buyerReplies() + this.sellerReplies()) / 4) * 100))
  );

  public async fetchBondStatus(orderId: string): Promise<ChatBondStatusResponse | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ChatBondStatusResponse>(`${this.apiUrl}/chatbond/${orderId}/status`)
      );
      this.bondStatus.set(res);
      this.isRefundEligible.set(res.isRefundEligible);
      this.buyerReplies.set(res.buyerReplies);
      this.sellerReplies.set(res.sellerReplies);
      return res;
    } catch {
      // Mock status for development
      const mock: ChatBondStatusResponse = {
        orderId,
        buyerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        sellerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        depositAmount: 0.3,
        buyerReplies: 1,
        sellerReplies: 1,
        isRefundEligible: false,
        status: 'Active',
        createdAtUtc: new Date().toISOString(),
        lastActivityAtUtc: new Date().toISOString(),
      };
      this.bondStatus.set(mock);
      this.isRefundEligible.set(mock.isRefundEligible);
      this.buyerReplies.set(mock.buyerReplies);
      this.sellerReplies.set(mock.sellerReplies);
      return mock;
    }
  }

  public async recordReply(orderId: string, senderAddress: string, encryptedPayload: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ isRefundEligible: boolean; buyerReplies: number; sellerReplies: number }>(
          `${this.apiUrl}/chatbond/${orderId}/record-reply`,
          { senderAddress, encryptedPayload }
        )
      );
      this.isRefundEligible.set(res.isRefundEligible);
      this.buyerReplies.set(res.buyerReplies);
      this.sellerReplies.set(res.sellerReplies);
    } catch {
      // Update local signals
      const b = this.buyerReplies() + 1;
      const s = this.sellerReplies() + 1;
      this.buyerReplies.set(b);
      this.sellerReplies.set(s);
      this.isRefundEligible.set(b >= 2 && s >= 2);
    }
  }

  public async depositBond(orderId: string, amountUsdt: number = 0.3): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/chatbond/${orderId}/deposit`, { amountUsdt })
      );
      return true;
    } catch {
      // Mock success for development
      return true;
    }
  }

  public async claimRefund(orderId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/chatbond/${orderId}/claim-refund`, {})
      );
      this.isRefundEligible.set(false);
      return true;
    } catch {
      // Mock success for development
      this.isRefundEligible.set(false);
      return true;
    }
  }
}
