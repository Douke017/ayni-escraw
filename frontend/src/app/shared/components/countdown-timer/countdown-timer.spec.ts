// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CountdownTimerComponent } from './countdown-timer.component';

describe('CountdownTimerComponent', () => {
  let fixture: ComponentFixture<CountdownTimerComponent>;
  let component: CountdownTimerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountdownTimerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CountdownTimerComponent);
    component = fixture.componentInstance;
  });

  it('should compute progress and urgency for safe meet 60s', () => {
    fixture.componentRef.setInput('totalSeconds', 60);
    fixture.componentRef.setInput('remainingSeconds', 60);
    expect(component.progress()).toBe(1);
    expect(component.urgencyState()).toBe('normal');
    expect(component.formattedTime()).toBe('1:00');

    // Test urgency when less than 10s remain
    fixture.componentRef.setInput('remainingSeconds', 5);
    expect(component.urgencyState()).toBe('urgent');
    expect(component.formattedTime()).toBe('0:05');
  });
});
