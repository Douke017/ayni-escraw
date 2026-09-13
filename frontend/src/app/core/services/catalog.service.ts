// SPDX-License-Identifier: MIT
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ProductListing,
  ListingStatus,
  ValidationVerdict,
  ProofOfListingChallenge,
  CreateListingPayload,
} from '../models/listing.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  // Vanilla Signals
  public readonly listings = signal<ProductListing[]>([]);
  public readonly selectedListing = signal<ProductListing | null>(null);
  public readonly isLoading = signal<boolean>(false);
  public readonly activeCategory = signal<string>('ALL');
  public readonly searchQuery = signal<string>('');
  public readonly error = signal<string | null>(null);

  public async fetchListings(
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    search?: string
  ): Promise<ProductListing[]> {
    this.isLoading.set(true);
    this.error.set(null);

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
        this.http.get<ProductListing[]>(`${this.apiUrl}/products`, { params })
      );
      this.listings.set(data || []);
      return data || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar el catálogo';
      this.error.set(msg);
      this.listings.set([]);
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  public async getListingById(id: string): Promise<ProductListing | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const item = await firstValueFrom(
        this.http.get<ProductListing>(`${this.apiUrl}/products/${id}`)
      );
      this.selectedListing.set(item || null);
      return item || null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al obtener el producto';
      this.error.set(msg);
      this.selectedListing.set(null);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  public async requestProofChallenge(sellerAddress: string): Promise<ProofOfListingChallenge> {
    return await firstValueFrom(
      this.http.post<ProofOfListingChallenge>(`${this.apiUrl}/products/challenge`, {
        sellerAddress,
      })
    );
  }

  public async getProofOfListingChallenge(sellerAddress: string): Promise<ProofOfListingChallenge> {
    return await this.requestProofChallenge(sellerAddress);
  }

  public async createListing(
    payload: CreateListingPayload,
    images: File[] = []
  ): Promise<{ listing: ProductListing }> {
    let res: { listing: ProductListing };
    if (images && images.length > 0) {
      const form = new FormData();
      form.append('product', JSON.stringify(payload));
      for (const image of images) {
        form.append('images', image, image.name);
      }
      res = await firstValueFrom(
        this.http.post<{ listing: ProductListing }>(`${this.apiUrl}/products`, form)
      );
    } else {
      res = await firstValueFrom(
        this.http.post<{ listing: ProductListing }>(`${this.apiUrl}/products`, payload)
      );
    }
    this.listings.update((current) => [res.listing, ...current]);
    return res;
  }
}

