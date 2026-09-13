// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'ayni-aguayo-stripe',
  standalone: true,
  templateUrl: './aguayo-stripe.component.html',
  styleUrl: './aguayo-stripe.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AguayoStripeComponent {
  public readonly accentColor = input<string>('var(--aguayo-gold)');
  public readonly height = input<number>(3);
}
