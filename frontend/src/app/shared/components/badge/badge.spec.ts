// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;
  let component: BadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
    component = fixture.componentInstance;
  });

  it('should create badge with default neutral variant', () => {
    expect(component).toBeTruthy();
    expect(component.variant()).toBe('neutral');
    expect(component.size()).toBe('md');
  });

  it('should apply pass class when variant is pass', () => {
    fixture.componentRef.setInput('variant', 'pass');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.ayni-badge');
    expect(el.classList.contains('ayni-badge--pass')).toBe(true);
  });
});
