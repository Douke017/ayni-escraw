// SPDX-License-Identifier: MIT

export enum OrderStatus {
  Created = 0,
  Funded = 1,
  HandoffConfirmed = 2,
  InspectionWindow = 3,
  Settled = 4,
  Disputed = 5,
  Refunded = 6,
}

export interface EscrowOrder {
  id: string;
  onChainOrderId: string;
  listingId?: string;
  buyerAddress: string;
  sellerAddress: string;
  arbitratorAddress: string;
  amountUsdt: number;
  passportTokenId: number;
  status: OrderStatus;
  createdAtUtc: string;
  handoffConfirmedAtUtc?: string;
  inspectionDeadlineUtc?: string;
  safeMeetQrNonce?: string;
  settlementTxHash?: string;
  isDisputed: boolean;
  disputeReason?: string;
}

export interface SafeMeetQrResponse {
  orderId: string;
  nonce: string;
  ttlSeconds: number;
  expiresAtUtc: string;
}

export interface ValidateQrResult {
  success: boolean;
  status: string;
  inspectionDeadlineUtc?: string;
}
