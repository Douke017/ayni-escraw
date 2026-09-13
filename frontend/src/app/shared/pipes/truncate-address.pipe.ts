// SPDX-License-Identifier: MIT
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateAddress',
  standalone: true,
})
export class TruncateAddressPipe implements PipeTransform {
  transform(address: string | null | undefined, startChars: number = 6, endChars: number = 4): string {
    if (!address) return '';
    if (address.length <= startChars + endChars) return address;
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }
}
