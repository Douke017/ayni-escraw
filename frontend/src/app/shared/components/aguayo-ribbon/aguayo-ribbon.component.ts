// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'ayni-aguayo-ribbon',
  standalone: true,
  templateUrl: './aguayo-ribbon.component.html',
  styleUrl: './aguayo-ribbon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AguayoRibbonComponent {
  public readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('md');
  public readonly height = input<number | string | null>(null);
  public readonly rounded = input<boolean>(false);
}
