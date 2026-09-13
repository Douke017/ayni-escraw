// SPDX-License-Identifier: MIT
export interface SellerReview {
  id: string;
  sellerAddress: string;
  buyerAddress: string;
  orderId?: string;
  productTitle: string;
  productCategory: string;
  rating: number; // 1 to 5
  hardwareAccuracyRating: number; // 1 to 5
  safeMeetPunctualityRating: number; // 1 to 5
  communicationRating: number; // 1 to 5
  comment: string;
  isEscrowVerified: boolean;
  onChainTxHash?: string;
  createdAt: string;
}

export interface SellerReputationSummary {
  sellerAddress: string;
  averageRating: number;
  totalReviews: number;
  totalEscrowVolumeUsdt: number;
  successfulDeals: number;
  disputeCount: number;
  hardwareAccuracyPct: number;
  safeMeetPunctualityPct: number;
  communicationPct: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}
