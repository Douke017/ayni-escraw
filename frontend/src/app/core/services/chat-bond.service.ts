// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatBondStatusResponse, ChatMessage } from '../models/chat.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatBondService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  // Vanilla Signals
  public readonly bondStatus = signal<ChatBondStatusResponse | null>(null);
  public readonly isRefundEligible = signal<boolean>(false);
  public readonly buyerReplies = signal<number>(0);
  public readonly sellerReplies = signal<number>(0);
  public readonly error = signal<string | null>(null);

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
      this.error.set(null);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al consultar estado del chat bond';
      this.error.set(msg);
      return null;
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
      this.error.set(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar respuesta en chat bond';
      this.error.set(msg);
      throw err;
    }
  }

  public async fetchMessages(orderId: string): Promise<ChatMessage[]> {
    try {
      const list = await firstValueFrom(
        this.http.get<ChatMessage[]>(`${this.apiUrl}/chatbond/${orderId}/messages`)
      );
      return list || [];
    } catch {
      return [];
    }
  }

  public async depositBond(params: {
    orderId: string;
    buyerAddress: string;
    sellerAddress: string;
    amountUsdt?: number;
    depositTxHash?: string;
  }): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/chatbond/deposit`, {
          orderId: params.orderId,
          buyerAddress: params.buyerAddress,
          sellerAddress: params.sellerAddress,
          depositAmountUsdt: params.amountUsdt || 0.3,
          depositTxHash: params.depositTxHash,
        })
      );
      this.error.set(null);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al depositar chat bond';
      this.error.set(msg);
      throw err;
    }
  }

  public async claimRefund(orderId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/chatbond/${orderId}/claim-refund`, {})
      );
      this.isRefundEligible.set(false);
      this.error.set(null);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar reembolso del chat bond';
      this.error.set(msg);
      throw err;
    }
  }
}
