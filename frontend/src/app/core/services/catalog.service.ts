// SPDX-License-Identifier: MIT
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ProductListing,
  ProofOfListingChallenge,
  CreateListingPayload,
} from '../models/listing.model';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api';

  // Vanilla Signals
  public readonly listings = signal<ProductListing[]>([]);
  public readonly selectedListing = signal<ProductListing | null>(null);
  public readonly isLoading = signal<boolean>(false);
  public readonly activeCategory = signal<string>('ALL');
  public readonly searchQuery = signal<string>('');

  public async fetchListings(
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    search?: string
  ): Promise<ProductListing[]> {
    this.isLoading.set(true);

    let params = new HttpParams();
    if (category && category !== 'ALL') {
      params = params.set('category', category);
    }
    if (minPrice !== undefined && minPrice > 0) {
      params = params.set('minPrice', minPrice.toString());
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      params = params.set('maxPrice', maxPrice.toString());
    }
    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }

    try {
      const data = await firstValueFrom(
        this.http.get<ProductListing[]>(`${this.apiUrl}/catalog`, { params })
      );
      this.listings.set(data);
      return data;
    } catch {
      // Fallback mock catalog for testing or offline dev
      const mock = this.getMockListings();
      this.listings.set(mock);
      return mock;
    } finally {
      this.isLoading.set(false);
    }
  }

  public async getListingById(id: string): Promise<ProductListing | null> {
    this.isLoading.set(true);
    try {
      const item = await firstValueFrom(
        this.http.get<ProductListing>(`${this.apiUrl}/catalog/${id}`)
      );
      this.selectedListing.set(item);
      return item;
    } catch {
      const found = this.listings().find((l) => l.id === id) || this.getMockListings()[0];
      this.selectedListing.set(found);
      return found;
    } finally {
      this.isLoading.set(false);
    }
  }

  public async requestProofChallenge(sellerAddress: string): Promise<ProofOfListingChallenge> {
    return await firstValueFrom(
      this.http.post<ProofOfListingChallenge>(`${this.apiUrl}/catalog/challenge`, {
        sellerAddress,
      })
    );
  }

  public async getProofOfListingChallenge(sellerAddress: string = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'): Promise<ProofOfListingChallenge> {
    try {
      return await this.requestProofChallenge(sellerAddress);
    } catch {
      return {
        challengeNonce: 'AYNI-8492',
        uploadUrl: 'http://localhost:9000/ayni-pol/challenge_8492.jpg',
        objectKey: 'challenge_8492.jpg',
        expiresAtUtc: new Date(Date.now() + 900000).toISOString(),
      };
    }
  }

  public async createListing(payload: CreateListingPayload): Promise<{ listing: ProductListing }> {
    return await firstValueFrom(
      this.http.post<{ listing: ProductListing }>(`${this.apiUrl}/catalog`, payload)
    );
  }

  private getMockListings(): ProductListing[] {
    return [
      {
        id: '11111111-1111-1111-1111-111111111111',
        sellerAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        title: 'iPhone 13 Pro 128GB Azul Sierra',
        description: 'Batería al 88%, sin detalles cosméticos, 100% desbloqueado de fábrica. Verificado con pasaporte digital.',
        category: 'SMARTPHONE',
        priceUsdt: 520.0,
        declaredCondition: 5,
        proofHash: '0x99887766554433221100aabbccddeeff00112233445566778899aabbccddeeff',
        commitmentSalt: '0xsalt_iphone_13_pro_2026',
        status: 1,
        technicalAttributesJson: JSON.stringify({
          brand: 'Apple',
          model: 'iPhone 13 Pro',
          storage: '128GB',
          ram: '6GB',
          battery_health_percentage: 88,
          carrier_lock_status: 'Unlocked',
        }),
        attestationVerdict: 0,
        validatorAgentId: 42,
        createdAtUtc: new Date().toISOString(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        sellerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        title: 'MacBook Pro M2 16GB 512GB Gris Espacial',
        description: 'Solo 18 ciclos de carga. Incluye cargador original MagSafe de 67W. Diagnóstico físico impecable.',
        category: 'LAPTOP',
        priceUsdt: 1250.0,
        declaredCondition: 5,
        proofHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        commitmentSalt: '0xsalt_macbook_m2_2026',
        status: 1,
        technicalAttributesJson: JSON.stringify({
          brand: 'Apple',
          model: 'MacBook Pro M2',
          storage: '512GB SSD',
          ram: '16GB Unified',
          battery_health_percentage: 99,
          battery_cycles: 18,
        }),
        attestationVerdict: 0,
        validatorAgentId: 42,
        createdAtUtc: new Date().toISOString(),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        sellerAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
        title: 'NVIDIA GeForce RTX 4070 12GB Gaming OC',
        description: 'Uso exclusivo para edición y render 3D, nunca usada en minería. Backplate y temperaturas perfectas.',
        category: 'COMPONENT',
        priceUsdt: 580.0,
        declaredCondition: 4,
        proofHash: '0x7766554433221100aabbccddeeff00112233445566778899aabbccddeeff0011',
        commitmentSalt: '0xsalt_rtx_4070_2026',
        status: 1,
        technicalAttributesJson: JSON.stringify({
          brand: 'Gigabyte',
          model: 'GeForce RTX 4070',
          vram: '12GB GDDR6X',
          mining_detected: false,
          max_temp_celsius: 64,
        }),
        attestationVerdict: 0,
        validatorAgentId: 42,
        createdAtUtc: new Date().toISOString(),
      },
    ];
  }
}
