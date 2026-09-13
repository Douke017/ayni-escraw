// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'ayni-aguayo-pattern',
  standalone: true,
  templateUrl: './aguayo-pattern.component.html',
  styleUrl: './aguayo-pattern.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AguayoPatternComponent {
  public readonly variant = input<'vibrant' | 'detailed'>('detailed');
  public readonly opacity = input<number>(0.15);
}
