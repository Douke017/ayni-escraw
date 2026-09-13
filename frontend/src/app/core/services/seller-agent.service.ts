// SPDX-License-Identifier: MIT
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductListing } from '../models/listing.model';

export interface AutonomousPublishResult {
  success: boolean;
  listing: ProductListing;
  detectedSpecs: {
    category: string;
    brand: string;
    model: string;
    title: string;
    description: string;
    storage?: string;
    ram?: string;
    color?: string;
    declaredCondition: number;
    accessories?: string;
    confidenceScore: number;
    inspectionNotes?: string;
  };
  agent: {
    agentId: number;
    agentAddress: string;
    registryAddress: string;
    subscriptionManager: string;
    hskExplorerTx: string;
  };
}

export interface ChatReplyResult {
  success: boolean;
  reply: string;
  intent: string; // OFFER, QUESTION, COORDINATION, GENERAL
  action: string; // ACCEPT, AUTO_ACCEPT, COUNTER_OFFER, REJECT, ANSWER, COORDINATE
  counterPrice?: number;
  agentId: number;
  agentAddress: string;
  hskExplorerUrl: string;
}

export interface HskInfoResult {
  agentId: number;
  agentAddress: string;
  agentRegistryAddress: string;
  subscriptionManagerAddress: string;
  hskExplorerUrl: string;
  agentRegistryUrl: string;
  subscriptionManagerUrl: string;
  erc8004Standard: string;
}

@Injectable({
  providedIn: 'root',
})
export class SellerAgentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  public readonly isPublishing = signal<boolean>(false);
  public readonly publishProgress = signal<number>(0);
  public readonly currentAnalysisStep = signal<string>('');
  public readonly hskInfo = signal<HskInfoResult | null>(null);

  public async getHskInfo(): Promise<HskInfoResult | null> {
    try {
      const data = await firstValueFrom(
        this.http.get<HskInfoResult>(`${this.apiUrl}/seller-agent/hsk-info`)
      );
      this.hskInfo.set(data);
      return data;
    } catch (e) {
      console.warn('Failed to fetch HSK info:', e);
      return null;
    }
  }

  public async autonomousPublish(
    image: File,
    priceUsdt: number,
    sellerAddress: string,
    categoryHint: string = 'SMARTPHONE'
  ): Promise<AutonomousPublishResult> {
    this.isPublishing.set(true);
    this.publishProgress.set(15);
    this.currentAnalysisStep.set('Iniciando inspección multimodal con Gemini Vision...');

    const formData = new FormData();
    formData.append('image', image, image.name);
    formData.append('priceUsdt', priceUsdt.toString());
    formData.append('sellerAddress', sellerAddress);
    formData.append('categoryHint', categoryHint);

    try {
      this.publishProgress.set(45);
      this.currentAnalysisStep.set('Extrayendo marca, modelo, chasis y condición física...');

      const response = await firstValueFrom(
        this.http.post<AutonomousPublishResult>(
          `${this.apiUrl}/seller-agent/autonomous-publish`,
          formData
        )
      );

      this.publishProgress.set(85);
      this.currentAnalysisStep.set('Atestando dictamen ERC-8004 y acuñando en HSK Chain...');

      setTimeout(() => {
        this.publishProgress.set(100);
        this.currentAnalysisStep.set('¡Publicación completada con éxito!');
        this.isPublishing.set(false);
      }, 500);

      return response;
    } catch (err: unknown) {
      this.isPublishing.set(false);
      this.publishProgress.set(0);
      this.currentAnalysisStep.set('');
      throw err;
    }
  }

  public async getChatReply(
    orderId: string,
    message: string,
    buyerAddress?: string
  ): Promise<ChatReplyResult> {
    const payload = {
      orderId,
      message,
      buyerAddress: buyerAddress || '0xBuyer',
    };

    return await firstValueFrom(
      this.http.post<ChatReplyResult>(`${this.apiUrl}/seller-agent/chat-reply`, payload)
    );
  }
}
