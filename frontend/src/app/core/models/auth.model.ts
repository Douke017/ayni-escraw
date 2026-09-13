// SPDX-License-Identifier: MIT

export interface SiweNonceResponse {
  address: string;
  nonce: string;
  expiresAtUtc: string;
}

export interface UserSession {
  id: string;
  address: string;
  walletAddress?: string;
  role: 'Buyer' | 'Seller' | 'Arbitrator';
}

export interface AuthVerifyResponse {
  token: string;
  user: UserSession;
}
