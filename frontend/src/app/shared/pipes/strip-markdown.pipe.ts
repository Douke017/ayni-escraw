// SPDX-License-Identifier: MIT
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stripMarkdown',
  standalone: true,
})
export class StripMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .replace(/\\n/g, ' ')
      .replace(/\r?\n/g, ' ')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/\s+-\s+\*\*/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
