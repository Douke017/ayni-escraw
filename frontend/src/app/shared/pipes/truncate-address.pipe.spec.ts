// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TruncateAddressPipe } from './truncate-address.pipe';

describe('TruncateAddressPipe', () => {
  const pipe = new TruncateAddressPipe();

  it('should truncate ethereum address to 0x1234...abcd', () => {
    const addr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    expect(pipe.transform(addr)).toBe('0x7099...79C8');
  });

  it('should return empty string for null or empty input', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
  });
});
