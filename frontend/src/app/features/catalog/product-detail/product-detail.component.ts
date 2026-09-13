import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { CatalogService } from '../../../core/services/catalog.service';
import { ProductListing, ValidationVerdict } from '../../../core/models/listing.model';
import { HARDWARE_CATEGORIES } from '../../../core/models/category.model';
import { AguayoStripeComponent } from '../../../shared/components/aguayo-stripe/aguayo-stripe.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../../shared/pipes/truncate-address.pipe';

@Component({
  selector: 'ayni-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    KeyValuePipe,
    AguayoStripeComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    UsdtPipe,
    TruncateAddressPipe,
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

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.listingId.set(id);
      this.loadListing(id);
    }
  }

  private loadListing(id: string): void {
    this.isLoading.set(true);
    // Find in currently cached listings or fallback
    const found = this.catalogService.listings().find((l) => l.id === id);
    if (found) {
      this.listing.set(found);
      this.isLoading.set(false);
    } else {
      // Refresh catalog and look again
      this.catalogService.fetchListings().then(() => {
        const refound = this.catalogService.listings().find((l) => l.id === id);
        this.listing.set(refound || null);
        this.isLoading.set(false);
      });
    }
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
