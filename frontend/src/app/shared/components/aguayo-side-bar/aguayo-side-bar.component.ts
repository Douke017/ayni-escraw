// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'ayni-aguayo-side-bar',
  standalone: true,
  templateUrl: './aguayo-side-bar.component.html',
  styleUrl: './aguayo-side-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AguayoSideBarComponent {
  public readonly primaryColor = input<string>('var(--aguayo-red)');
}
