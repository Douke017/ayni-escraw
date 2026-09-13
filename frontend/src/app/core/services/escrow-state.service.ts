import { Injectable, signal, computed } from '@angular/core';

export enum EscrowUiStatus {
  CREATED = 0,
  FUNDED = 1,
  HANDOFF_CONFIRMED = 2,
  INSPECTION_WINDOW = 3,
  SETTLED = 4,
  DISPUTED = 5,
  REFUNDED = 6,
}

export interface EscrowOrderUi {
  orderId: string;
  buyer: string;
  seller: string;
  amountUsdt: string;
  status: EscrowUiStatus;
  inspectionDeadline: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class EscrowStateService {
  // Vanilla Signals
  public readonly selectedOrder = signal<EscrowOrderUi | null>(null);
  public readonly status = signal<EscrowUiStatus>(EscrowUiStatus.CREATED);
  public readonly remainingInspectionSeconds = signal<number>(0);

  // Computed signals
  public readonly isSettled = computed(() => this.status() === EscrowUiStatus.SETTLED);
  public readonly isDisputed = computed(() => this.status() === EscrowUiStatus.DISPUTED);
  public readonly isInspectionActive = computed(() => this.status() === EscrowUiStatus.INSPECTION_WINDOW);
  public readonly canSettleEarly = computed(() => this.status() === EscrowUiStatus.INSPECTION_WINDOW);

  public setOrder(order: EscrowOrderUi): void {
    this.selectedOrder.set(order);
    this.status.set(order.status);
  }

  public updateStatus(newStatus: EscrowUiStatus): void {
    this.status.set(newStatus);
    this.selectedOrder.update((curr) => (curr ? { ...curr, status: newStatus } : null));
  }

  public updateTimer(seconds: number): void {
    this.remainingInspectionSeconds.set(seconds);
  }
}
