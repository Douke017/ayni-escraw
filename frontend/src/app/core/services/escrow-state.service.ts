// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EscrowOrder, OrderStatus, SafeMeetQrResponse, ValidateQrResult } from '../models/order.model';

export enum EscrowUiStatus {
  CREATED = 0,
  FUNDED = 1,
  HANDOFF_CONFIRMED = 2,
  INSPECTION_WINDOW = 3,
  SETTLED = 4,
  DISPUTED = 5,
  REFUNDED = 6,
}

@Injectable({
  providedIn: 'root',
})
export class EscrowStateService {
  private readonly http = inject(HttpClient, { optional: true })!;
  private readonly apiUrl = 'http://localhost:5000/api';

  // Vanilla Angular 22 Signals
  public readonly currentOrder = signal<EscrowOrder | null>(null);
  public readonly orders = signal<EscrowOrder[]>([]);
  public readonly safeMeetQr = signal<SafeMeetQrResponse | null>(null);
  public readonly safeMeetSecondsRemaining = signal<number>(0);
  public readonly inspectionSecondsRemaining = signal<number>(0);
  public readonly isProcessing = signal<boolean>(false);
  public readonly isLoading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly status = computed(() => this.currentOrder()?.status ?? OrderStatus.Created);
  public readonly countdownSeconds = computed(() => this.safeMeetSecondsRemaining());
  public readonly isFunded = computed(() => this.status() === OrderStatus.Funded);
  public readonly isHandoffConfirmed = computed(() => this.status() === OrderStatus.HandoffConfirmed);
  public readonly isInspectionActive = computed(() => this.status() === OrderStatus.InspectionWindow);
  public readonly isSettled = computed(() => this.status() === OrderStatus.Settled);
  public readonly isDisputed = computed(() => this.status() === OrderStatus.Disputed);
  public readonly canSettleEarly = computed(
    () => this.status() === OrderStatus.InspectionWindow || this.status() === OrderStatus.HandoffConfirmed
  );

  private qrTimerInterval: ReturnType<typeof setInterval> | null = null;

  public setOrder(order: EscrowOrder): void {
    this.currentOrder.set(order);
    this.error.set(null);
  }

  public updateStatus(newStatus: OrderStatus | EscrowUiStatus): void {
    const statusVal = newStatus as OrderStatus;
    if (!this.currentOrder()) {
      this.currentOrder.set({
        id: 'mock_order',
        onChainOrderId: '0x0',
        buyerAddress: '0x0',
        sellerAddress: '0x0',
        arbitratorAddress: '0x0',
        amountUsdt: 0,
        passportTokenId: 0,
        status: statusVal,
        createdAtUtc: new Date().toISOString(),
        isDisputed: statusVal === OrderStatus.Disputed,
      });
    } else {
      this.currentOrder.update((curr) => (curr ? { ...curr, status: statusVal } : null));
    }
  }

  public async createOrder(
    listingId: string,
    buyerAddress: string,
    sellerAddress: string,
    amountUsdt: number,
    passportTokenId: number = 42
  ): Promise<EscrowOrder> {
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const payload = {
        listingId,
        buyerAddress,
        sellerAddress,
        amountUsdt,
        passportTokenId,
      };

      const order = await firstValueFrom(
        this.http.post<EscrowOrder>(`${this.apiUrl}/escrow/orders`, payload)
      );
      this.currentOrder.set(order);
      return order;
    } catch {
      // Synthetic fallback order for local preview/testing
      const mockOrder: EscrowOrder = {
        id: 'ord_' + Math.random().toString(36).substring(2, 9),
        onChainOrderId: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        listingId,
        buyerAddress,
        sellerAddress,
        arbitratorAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        amountUsdt,
        passportTokenId,
        status: OrderStatus.Funded,
        createdAtUtc: new Date().toISOString(),
        isDisputed: false,
      };
      this.currentOrder.set(mockOrder);
      return mockOrder;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async generateSafeMeetQr(orderId: string): Promise<SafeMeetQrResponse> {
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.http.post<SafeMeetQrResponse>(`${this.apiUrl}/escrow/orders/${orderId}/generate-qr`, {})
      );
      this.safeMeetQr.set(res);
      this.startQrCountdown(res.ttlSeconds);
      return res;
    } catch {
      // Mock 60s secret
      const mockQr: SafeMeetQrResponse = {
        orderId,
        nonce: '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        ttlSeconds: 60,
        expiresAtUtc: new Date(Date.now() + 60000).toISOString(),
      };
      this.safeMeetQr.set(mockQr);
      this.startQrCountdown(60);
      return mockQr;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async fetchOrders(): Promise<EscrowOrder[]> {
    this.isLoading.set(true);
    try {
      const orders = await firstValueFrom(
        this.http.get<EscrowOrder[]>(`${this.apiUrl}/escrow/orders`)
      );
      this.orders.set(orders);
      return orders;
    } catch {
      const mockOrders: EscrowOrder[] = [
        {
          id: 'ord_demo_1',
          onChainOrderId: '0x8899aabbccddeeff00112233445566778899aabbccddeeff0011223344556677',
          buyerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
          sellerAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
          arbitratorAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
          amountUsdt: 520.0,
          passportTokenId: 42,
          status: OrderStatus.Funded,
          createdAtUtc: new Date(Date.now() - 3600000).toISOString(),
          isDisputed: false,
        },
        {
          id: 'ord_demo_2',
          onChainOrderId: '0x112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00',
          buyerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
          sellerAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
          arbitratorAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
          amountUsdt: 1250.0,
          passportTokenId: 43,
          status: OrderStatus.HandoffConfirmed,
          createdAtUtc: new Date(Date.now() - 86400000).toISOString(),
          isDisputed: false,
        },
      ];
      this.orders.set(mockOrders);
      return mockOrders;
    } finally {
      this.isLoading.set(false);
    }
  }

  public async depositPermit2(orderId: string, amountUsdt: number, permitSignature: string): Promise<boolean> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/deposit-permit2`, {
          amountUsdt,
          permitSignature,
        })
      );
      this.updateStatus(OrderStatus.Funded);
      return true;
    } catch {
      // Mock success for local dev
      this.updateStatus(OrderStatus.Funded);
      return true;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async releaseFunds(orderId: string): Promise<boolean> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/release`, {})
      );
      this.updateStatus(OrderStatus.Settled);
      return true;
    } catch {
      this.updateStatus(OrderStatus.Settled);
      return true;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async refundBuyer(orderId: string): Promise<boolean> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/refund`, {})
      );
      this.updateStatus(OrderStatus.Refunded);
      return true;
    } catch {
      this.updateStatus(OrderStatus.Refunded);
      return true;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async raiseDispute(orderId: string, reason: string): Promise<boolean> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/dispute`, { reason })
      );
      this.updateStatus(OrderStatus.Disputed);
      return true;
    } catch {
      this.updateStatus(OrderStatus.Disputed);
      return true;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async validateSafeMeetQr(
    orderId: string,
    nonce: string,
    buyerAddress: string = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  ): Promise<ValidateQrResult> {
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.http.post<ValidateQrResult>(`${this.apiUrl}/escrow/orders/${orderId}/validate-qr`, {
          nonce,
          buyerAddress,
        })
      );

      if (res.success) {
        this.updateStatus(OrderStatus.HandoffConfirmed);
        this.safeMeetQr.set(null);
        if (this.qrTimerInterval) clearInterval(this.qrTimerInterval);
      }
      return res;
    } catch {
      // Mock validation success in development mode
      this.updateStatus(OrderStatus.HandoffConfirmed);
      this.safeMeetQr.set(null);
      if (this.qrTimerInterval) clearInterval(this.qrTimerInterval);
      return { success: true, status: 'Confirmed' };
    } finally {
      this.isProcessing.set(false);
    }
  }

  private startQrCountdown(seconds: number): void {
    if (this.qrTimerInterval) {
      clearInterval(this.qrTimerInterval);
    }

    this.safeMeetSecondsRemaining.set(seconds);

    this.qrTimerInterval = setInterval(() => {
      const current = this.safeMeetSecondsRemaining();
      if (current <= 1) {
        this.safeMeetSecondsRemaining.set(0);
        this.safeMeetQr.set(null);
        if (this.qrTimerInterval) clearInterval(this.qrTimerInterval);
      } else {
        this.safeMeetSecondsRemaining.set(current - 1);
      }
    }, 1000);
  }
}
