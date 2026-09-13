// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../../core/services/catalog.service';
import { HARDWARE_CATEGORIES } from '../../../core/models/category.model';
import { ProductListing, ValidationVerdict } from '../../../core/models/listing.model';
import { AguayoRibbonComponent } from '../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../../shared/pipes/truncate-address.pipe';

@Component({
  selector: 'ayni-catalog-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    AguayoRibbonComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    UsdtPipe,
    TruncateAddressPipe,
  ],
  templateUrl: './catalog-list.component.html',
  styleUrl: './catalog-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent implements OnInit {
  protected readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);

  public readonly categories = HARDWARE_CATEGORIES;
  public readonly selectedCategory = signal<string>('ALL');
  public readonly searchQuery = signal<string>('');
  public readonly sortBy = signal<'newest' | 'price_asc' | 'price_desc'>('newest');

  public readonly filteredListings = computed(() => {
    let items = this.catalogService.listings();

    const cat = this.selectedCategory();
    if (cat !== 'ALL') {
      items = items.filter((i) => i.category.toUpperCase() === cat.toUpperCase());
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    const sort = this.sortBy();
    if (sort === 'price_asc') {
      items = [...items].sort((a, b) => a.priceUsdt - b.priceUsdt);
    } else if (sort === 'price_desc') {
      items = [...items].sort((a, b) => b.priceUsdt - a.priceUsdt);
    }

    return items;
  });

  public ngOnInit(): void {
    this.catalogService.fetchListings();
    this.route.queryParams.subscribe((params) => {
      if (params['category']) {
        this.selectedCategory.set(params['category']);
      }
    });
  }

  public setCategory(catKey: string): void {
    this.selectedCategory.set(catKey);
  }

  public getCategoryColor(catKey: string): string {
    const found = this.categories.find((c) => c.key === catKey.toUpperCase());
    return found ? found.aguayoColorToken : 'var(--aguayo-red)';
  }

  public getVerdictBadgeVariant(verdict?: ValidationVerdict): 'pass' | 'warn' | 'fail' | 'neutral' {
    if (verdict === ValidationVerdict.PASS) return 'pass';
    if (verdict === ValidationVerdict.WARN) return 'warn';
    if (verdict === ValidationVerdict.FAIL) return 'fail';
    return 'pass'; // default verified in catalog
  }
}
