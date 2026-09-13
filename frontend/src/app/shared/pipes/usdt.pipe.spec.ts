// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { UsdtPipe } from './usdt.pipe';

describe('UsdtPipe', () => {
  const pipe = new UsdtPipe();

  it('should format numbers to 2 decimal places with USDT suffix', () => {
    expect(pipe.transform(500)).toBe('500.00 USDT');
    expect(pipe.transform('1250.5')).toBe('1,250.50 USDT');
    expect(pipe.transform(0)).toBe('0.00 USDT');
  });
});
