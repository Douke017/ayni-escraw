// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'ayni-countdown-timer',
  standalone: true,
  templateUrl: './countdown-timer.component.html',
  styleUrl: './countdown-timer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountdownTimerComponent {
  public readonly totalSeconds = input<number>(60);
  public readonly remainingSeconds = input<number>(60);
  public readonly variant = input<'circular' | 'bar'>('circular');
  public readonly showLabels = input<boolean>(true);

  public readonly radius = 36;
  public readonly circumference = 2 * Math.PI * this.radius;

  public readonly progress = computed(() => {
    const total = this.totalSeconds();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, this.remainingSeconds() / total));
  });

  public readonly strokeDashoffset = computed(() => {
    return this.circumference * (1 - this.progress());
  });

  public readonly formattedTime = computed(() => {
    const s = Math.max(0, this.remainingSeconds());
    if (s >= 3600) {
      const hours = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      return `${hours}h ${mins.toString().padStart(2, '0')}m`;
    }
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  public readonly urgencyState = computed<'urgent' | 'warning' | 'normal'>(() => {
    const s = this.remainingSeconds();
    if (s <= 10) return 'urgent';
    if (s <= 25) return 'warning';
    return 'normal';
  });
}
