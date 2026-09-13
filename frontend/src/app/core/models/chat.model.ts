// SPDX-License-Identifier: MIT

export enum ChatBondStatus {
  Active = 0,
  RefundEligible = 1,
  Refunded = 2,
  Forfeited = 3,
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderAddress: string;
  encryptedPayload?: string;
  messageText?: string;
  sentAtUtc?: string;
  timestampUtc?: string;
  isAiAgent?: boolean;
}

export interface ChatBondStatusResponse {
  orderId: string;
  buyerAddress: string;
  sellerAddress: string;
  depositAmount: number;
  buyerReplies: number;
  sellerReplies: number;
  isRefundEligible: boolean;
  status: string;
  createdAtUtc: string;
  lastActivityAtUtc: string;
}
