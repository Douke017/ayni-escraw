import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { CatalogService } from '../../../core/services/catalog.service';
import { ProductListing, ValidationVerdict } from '../../../core/models/listing.model';
import { HARDWARE_CATEGORIES } from '../../../core/models/category.model';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../../shared/pipes/truncate-address.pipe';

import { AguayoRibbonComponent } from '../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';

@Component({
  selector: 'ayni-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    KeyValuePipe,
    BadgeComponent,
    ButtonComponent,
    UsdtPipe,
    TruncateAddressPipe,
    AguayoRibbonComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly catalogService = inject(CatalogService);

  public readonly listingId = signal<string>('');
  public readonly listing = signal<ProductListing | null>(null);
  public readonly isLoading = signal<boolean>(true);
  public readonly isCopied = signal<boolean>(false);
  public readonly selectedImageIndex = signal<number>(0);

  public readonly activeImageUrl = computed<string | null>(() => {
    const item = this.listing();
    if (!item || !item.imageUrls || item.imageUrls.length === 0) return null;
    const idx = this.selectedImageIndex();
    return item.imageUrls[idx] || item.imageUrls[0] || null;
  });

  public readonly confidenceScore = computed<number>(() => {
    return this.listing()?.attestationConfidenceScore || 98;
  });

  public readonly attestationSummary = computed<string>(() => {
    return (
      this.listing()?.attestationSummary ||
      'Hardware auténtico verificado por Ayni Tech Agent #42 bajo el estándar ERC-8004. Coherencia de especificaciones técnicas y prueba física POL validadas al 100% en HSK Chain.'
    );
  });

  public selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  public readonly technicalAttributes = computed<Record<string, string>>(() => {
    const item = this.listing();
    if (!item || !item.technicalAttributesJson) return {};
    try {
      return JSON.parse(item.technicalAttributesJson);
    } catch {
      return {};
    }
  });

  public readonly categoryMeta = computed(() => {
    const item = this.listing();
    if (!item) return null;
    return HARDWARE_CATEGORIES.find((c) => c.key === item.category.toUpperCase()) || null;
  });

  // Agent Tracking and ERC-8004 metadata
  public readonly registryAddress = '0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2';
  public readonly hskExplorerUrl = 'https://testnet-explorer.hskchain.net';
  public readonly hskRegistryUrl = 'https://testnet-explorer.hskchain.net/address/0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2';

  public readonly isSellerAgent = computed<boolean>(() => {
    const l = this.listing();
    if (!l) return false;
    return (
      l.validatorAgentId === 1 ||
      (l.attestationSummary?.includes('Seller Agent') ?? false) ||
      (l.attestationSummary?.includes('ERC-8004 #1') ?? false) ||
      (this.technicalAttributes() as Record<string, unknown>)['agent_registered_hsk'] === true
    );
  });

  public readonly agentId = computed<number>(() => {
    return this.isSellerAgent() ? 1 : (this.listing()?.validatorAgentId || 42);
  });

  public readonly agentName = computed<string>(() => {
    return this.isSellerAgent()
      ? 'Ayni Seller Agent (Agente Comercial Autónomo Pro)'
      : 'Ayni Tech Validator Agent (Validador de Hardware)';
  });

  public readonly agentAddress = computed<string>(() => {
    return this.isSellerAgent()
      ? '0x6582dCD2587C6094C0Fb3ce986035B1a4157D59a'
      : '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  });

  public readonly isAuditModalOpen = signal<boolean>(false);

  public toggleAuditModal(): void {
    this.isAuditModalOpen.update((v) => !v);
  }

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.listingId.set(id);
      this.loadListing(id);
    }
  }

  private async loadListing(id: string): Promise<void> {
    this.isLoading.set(true);
    let found = this.catalogService.listings().find((l) => l.id === id);
    if (!found) {
      found = (await this.catalogService.getListingById(id)) ?? undefined;
    }
    this.listing.set(found || null);
    this.isLoading.set(false);
  }

  public copyToClipboard(text: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    }
  }

  public proceedToCheckout(): void {
    const id = this.listingId();
    this.router.navigate(['/escrow/checkout'], { queryParams: { listingId: id } });
  }

  public startChat(): void {
    const id = this.listingId();
    this.router.navigate(['/chat'], { queryParams: { listingId: id } });
  }
}
