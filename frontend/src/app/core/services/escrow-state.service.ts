// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EscrowOrder, OrderStatus, SafeMeetQrResponse, ValidateQrResult } from '../models/order.model';
import { environment } from '../../../environments/environment';

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
  private readonly apiUrl = environment.apiBaseUrl;

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
    if (this.currentOrder()) {
      this.currentOrder.update((curr) => (curr ? { ...curr, status: statusVal, isDisputed: statusVal === OrderStatus.Disputed } : null));
    } else {
      this.currentOrder.set({
        id: '',
        onChainOrderId: '',
        buyerAddress: '',
        sellerAddress: '',
        arbitratorAddress: '',
        amountUsdt: 0,
        passportTokenId: 0,
        status: statusVal,
        createdAtUtc: new Date().toISOString(),
        isDisputed: statusVal === OrderStatus.Disputed,
      });
    }
  }

  public async createOrder(
    listingId: string,
    buyerAddress: string,
    sellerAddress: string,
    amountUsdt: number,
    passportTokenId: number = 4,
    onChainOrderId?: string
  ): Promise<EscrowOrder> {
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const payload: Record<string, unknown> = {
        listingId,
        buyerAddress,
        sellerAddress,
        amountUsdt,
        passportTokenId,
      };
      if (onChainOrderId) {
        payload['onChainOrderId'] = onChainOrderId;
      }

      const order = await firstValueFrom(
        this.http.post<EscrowOrder>(`${this.apiUrl}/escrow/orders`, payload)
      );
      this.currentOrder.set(order);
      return order;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear la orden de custodia';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async fetchOrderById(id: string): Promise<EscrowOrder | null> {
    try {
      const order = await firstValueFrom(
        this.http.get<EscrowOrder>(`${this.apiUrl}/escrow/orders/${id}`)
      );
      if (order) {
        this.currentOrder.set(order);
      }
      return order;
    } catch (err) {
      console.error('[Ayni Escrow] Failed to fetch order by id:', err);
      return null;
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar QR Safe Meet';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async fetchOrders(): Promise<EscrowOrder[]> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const orders = await firstValueFrom(
        this.http.get<EscrowOrder[]>(`${this.apiUrl}/escrow/orders`)
      );
      this.orders.set(orders || []);
      return orders || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al consultar órdenes';
      this.error.set(msg);
      this.orders.set([]);
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  public async depositPermit2(orderId: string, amountUsdt: number, permitSignature: string, txHash?: string): Promise<boolean> {
    this.isProcessing.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/deposit-permit2`, {
          amountUsdt,
          permitSignature,
          txHash: txHash || '',
        })
      );
      this.updateStatus(OrderStatus.Funded);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en el depósito Permit2';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async releaseFunds(orderId: string, txHash?: string): Promise<boolean> {
    this.isProcessing.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/settle`, { txHash: txHash || '' })
      );
      this.updateStatus(OrderStatus.Settled);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al liquidar fondos';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async refundBuyer(orderId: string, txHash?: string): Promise<boolean> {
    this.isProcessing.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/resolve-dispute`, {
          refundToBuyer: true,
          txHash: txHash || '',
        })
      );
      this.updateStatus(OrderStatus.Refunded);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar reembolso';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async raiseDispute(orderId: string, reason: string): Promise<boolean> {
    this.isProcessing.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/escrow/orders/${orderId}/dispute`, { reason })
      );
      this.updateStatus(OrderStatus.Disputed);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al abrir disputa';
      this.error.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  public async validateSafeMeetQr(
    orderId: string,
    nonce: string,
    buyerAddress: string
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al validar QR en Redis';
      this.error.set(msg);
      throw err;
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
