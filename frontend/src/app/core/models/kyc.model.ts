// SPDX-License-Identifier: MIT

export interface KycSessionResponse {
  sessionId: string;
  verificationUrl: string;
  status: string;
  expiresAtUtc: string;
}

export interface KycStatusResponse {
  walletAddress: string;
  isKycVerified: boolean;
  kycStatus: string;
  sessionId?: string;
  completedAtUtc?: string;
  canSell: boolean;
  canBuy: boolean;
}

export interface UserProfileResponse {
  id: string;
  walletAddress: string;
  role: string;
  isKycVerified: boolean;
  kycStatus: string;
  canBuy: boolean;
  canSell: boolean;
  availableRoles: string[];
  createdAtUtc: string;
  lastLoginAtUtc?: string;
}
