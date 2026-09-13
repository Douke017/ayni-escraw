// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import { SellerReview, SellerReputationSummary } from '../models/review.model';

@Injectable({
  providedIn: 'root',
})
export class ReviewsService {
  private readonly defaultReviews: SellerReview[] = [
    {
      id: 'rev-1',
      sellerAddress: '0x6582dcd2587c6094c0fb3ce986035b1a4157d59a',
      buyerAddress: '0x71c569754344722c336442422380e67173d1049b',
      productTitle: 'Apple iPhone 14 Pro 128GB Plata',
      productCategory: 'SMARTPHONE',
      rating: 5,
      hardwareAccuracyRating: 5,
      safeMeetPunctualityRating: 5,
      communicationRating: 5,
      comment: 'Excelente vendedor. El celular estaba en óptimas condiciones, tal cual analizó el Seller Agent. Hicimos Safe Meet en la estación central y con el QR liberamos los USDT al instante.',
      isEscrowVerified: true,
      onChainTxHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
      createdAt: 'Hace 2 días',
    },
    {
      id: 'rev-2',
      sellerAddress: '0x6582dcd2587c6094c0fb3ce986035b1a4157d59a',
      buyerAddress: '0x9965507d1a55bcc2695c58ba16fb37d819b0a4df',
      productTitle: 'Samsung Galaxy S23 Ultra 256GB Phantom Black',
      productCategory: 'SMARTPHONE',
      rating: 5,
      hardwareAccuracyRating: 5,
      safeMeetPunctualityRating: 5,
      communicationRating: 5,
      comment: 'Cero problemas con la prueba de posesión POL y el IMEI coincide exactamente con el compromiso criptográfico. El contrato AyniEscrow dio total tranquilidad.',
      isEscrowVerified: true,
      onChainTxHash: '0x1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b',
      createdAt: 'Hace 1 semana',
    },
    {
      id: 'rev-3',
      sellerAddress: '0x6582dcd2587c6094c0fb3ce986035b1a4157d59a',
      buyerAddress: '0x2546bcd3279f083c20415301403b170abe8dd641',
      productTitle: 'MacBook Air M2 16GB 512GB Medianoche',
      productCategory: 'LAPTOP',
      rating: 5,
      hardwareAccuracyRating: 5,
      safeMeetPunctualityRating: 4,
      communicationRating: 5,
      comment: 'Batería con 97% de salud real comprobada con software en el Video Verify. Vendedor muy recomendado en La Paz.',
      isEscrowVerified: true,
      onChainTxHash: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
      createdAt: 'Hace 2 semanas',
    },
    {
      id: 'rev-4',
      sellerAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      buyerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      productTitle: 'NVIDIA RTX 4080 Founders Edition 16GB',
      productCategory: 'COMPONENT',
      rating: 5,
      hardwareAccuracyRating: 5,
      safeMeetPunctualityRating: 5,
      communicationRating: 5,
      comment: 'Gráfica probada en bench de estrés durante la inspección. Cero calentamiento o artefactos. Trato 10/10.',
      isEscrowVerified: true,
      onChainTxHash: '0x8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e',
      createdAt: 'Hace 3 semanas',
    },
  ];

  public readonly reviews = signal<SellerReview[]>(this.defaultReviews);

  public getReviewsForSeller(sellerAddress: string): SellerReview[] {
    const normalized = sellerAddress.toLowerCase();
    const matches = this.reviews().filter(
      (r) => r.sellerAddress.toLowerCase() === normalized
    );
    return matches.length > 0 ? matches : this.defaultReviews.slice(0, 3);
  }

  public getReputationSummary(sellerAddress: string): SellerReputationSummary {
    const sellerReviews = this.getReviewsForSeller(sellerAddress);
    const totalReviews = sellerReviews.length;

    if (totalReviews === 0) {
      return {
        sellerAddress,
        averageRating: 5.0,
        totalReviews: 18,
        totalEscrowVolumeUsdt: 12450,
        successfulDeals: 18,
        disputeCount: 0,
        hardwareAccuracyPct: 99,
        safeMeetPunctualityPct: 100,
        communicationPct: 98,
        ratingBreakdown: { 5: 16, 4: 2, 3: 0, 2: 0, 1: 0 },
      };
    }

    const sumRating = sellerReviews.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = Number((sumRating / totalReviews).toFixed(1));

    return {
      sellerAddress,
      averageRating: avgRating > 0 ? avgRating : 4.9,
      totalReviews: 18,
      totalEscrowVolumeUsdt: 12450,
      successfulDeals: 18,
      disputeCount: 0,
      hardwareAccuracyPct: 99,
      safeMeetPunctualityPct: 100,
      communicationPct: 98,
      ratingBreakdown: {
        5: 16,
        4: 2,
        3: 0,
        2: 0,
        1: 0,
      },
    };
  }
}
