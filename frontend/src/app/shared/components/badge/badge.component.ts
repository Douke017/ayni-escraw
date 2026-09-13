// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

export type BadgeVariant = 'pass' | 'warn' | 'fail' | 'funded' | 'refund' | 'neutral' | 'hsk' | 'pol';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ayni-badge',
  standalone: true,
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  public readonly variant = input<BadgeVariant>('neutral');
  public readonly size = input<BadgeSize>('md');
  public readonly pulse = input<boolean>(false);
  public readonly icon = input<string | null>(null);
}
