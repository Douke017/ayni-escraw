// SPDX-License-Identifier: MIT

export enum ListingStatus {
  Draft = 0,
  Active = 1,
  Reserved = 2,
  Sold = 3,
  Archived = 4,
}

export enum ValidationVerdict {
  PASS = 0,
  WARN = 1,
  FAIL = 2,
}

export interface ProductListing {
  id: string;
  sellerAddress: string;
  title: string;
  description: string;
  category: string;
  priceUsdt: number;
  declaredCondition: number;
  proofHash: string;
  commitmentSalt: string;
  status: ListingStatus;
  technicalAttributesJson: string;
  attestationRequestHash?: string;
  attestationVerdict?: ValidationVerdict;
  validatorAgentId?: number;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface ProofOfListingChallenge {
  challengeNonce: string;
  uploadUrl: string;
  objectKey: string;
  expiresAtUtc: string;
}

export interface CreateListingPayload {
  sellerAddress: string;
  title: string;
  description: string;
  category: string;
  priceUsdt: number;
  declaredCondition: number;
  proofHash: string;
  commitmentSalt: string;
  hardwareIdentifier?: string;
  checklist?: Record<string, unknown>;
}
