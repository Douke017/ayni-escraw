// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AguayoRibbonComponent } from '../../../../shared/components/aguayo-ribbon/aguayo-ribbon.component';
import { AguayoPatternComponent } from '../../../../shared/components/aguayo-pattern/aguayo-pattern.component';

@Component({
  selector: 'ayni-footer',
  standalone: true,
  imports: [RouterLink, AguayoRibbonComponent, AguayoPatternComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  public readonly currentYear = new Date().getFullYear();
}
