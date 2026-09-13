// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;
  let component: ButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
  });

  it('should create button with primary variant and md size', () => {
    expect(component).toBeTruthy();
    expect(component.variant()).toBe('primary');
    expect(component.size()).toBe('md');
    expect(component.disabled()).toBe(false);
  });

  it('should emit clicked event when button is clicked and not disabled', () => {
    let emitted = false;
    component.clicked.subscribe(() => {
      emitted = true;
    });

    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(emitted).toBe(true);
  });
});
