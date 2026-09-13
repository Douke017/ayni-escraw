// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AguayoSideBarComponent } from '../aguayo-side-bar/aguayo-side-bar.component';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'ayni-card',
  standalone: true,
  imports: [AguayoSideBarComponent],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  public readonly sideBarColor = input<string | null>(null);
  public readonly hoverable = input<boolean>(true);
  public readonly padding = input<CardPadding>('md');
  public readonly interactive = input<boolean>(false);
}
