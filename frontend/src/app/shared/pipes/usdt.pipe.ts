// SPDX-License-Identifier: MIT
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'usdt',
  standalone: true,
})
export class UsdtPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0.00 USDT';
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) {
      return '0.00 USDT';
    }
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  }
}
