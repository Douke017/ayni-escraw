import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { HARDWARE_CATEGORIES } from '../../core/models/category.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { UsdtPipe } from '../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../shared/pipes/truncate-address.pipe';

import { AguayoRibbonComponent } from '../../shared/components/aguayo-ribbon/aguayo-ribbon.component';
import { AguayoPatternComponent } from '../../shared/components/aguayo-pattern/aguayo-pattern.component';
import { AguayoSideBarComponent } from '../../shared/components/aguayo-side-bar/aguayo-side-bar.component';

@Component({
  selector: 'ayni-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonComponent,
    UsdtPipe,
    TruncateAddressPipe,
    AguayoRibbonComponent,
    AguayoPatternComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  protected readonly catalogService = inject(CatalogService);
  public readonly categories = HARDWARE_CATEGORIES;

  public ngOnInit(): void {
    this.catalogService.fetchListings();
  }
}
