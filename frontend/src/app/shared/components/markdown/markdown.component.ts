// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'ayni-markdown',
  standalone: true,
  template: `
    <div class="ayni-markdown-content flex flex-col gap-1 w-full" [innerHTML]="formattedHtml()"></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownComponent {
  private readonly sanitizer = inject(DomSanitizer);

  public readonly content = input<string | null | undefined>('');

  public readonly formattedHtml = computed<SafeHtml>(() => {
    const raw = this.content();
    if (!raw) return '';
    const html = this.parseMarkdown(raw);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  private parseMarkdown(raw: string): string {
    if (!raw) return '';

    // 1. Normalize line endings and literal escaped newlines
    let text = raw.replace(/\r\n/g, '\n').replace(/\\n/g, '\n');

    // 2. Normalize inline bullets into line breaks
    // Matches e.g. "Dispositivo analizado. - **Precio:** 850 USDT - **Condición:** 4/5"
    text = text.replace(/([^\n])\s+-\s+\*\*/g, '$1\n- **');
    text = text.replace(/([^\n])\s+###\s+/g, '$1\n\n### ');

    // 3. Escape HTML entities to prevent XSS
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatInline = (str: string): string => {
      return str
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-ayni-espresso">$1</strong>')
        .replace(/__(.*?)__/g, '<strong class="font-bold text-ayni-espresso">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic text-ayni-espresso/90">$1</em>')
        .replace(/_(.*?)_/g, '<em class="italic text-ayni-espresso/90">$1</em>')
        .replace(
          /`([^`]+)`/g,
          '<code class="px-1.5 py-0.5 bg-ayni-espresso/10 text-ayni-espresso font-mono text-xs rounded border border-ayni-espresso/15">$1</code>'
        );
    };

    const lines = text.split('\n');
    const output: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();

      if (!rawLine) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        continue;
      }

      const escaped = escapeHtml(rawLine);

      if (escaped.startsWith('#### ')) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        output.push(
          `<h4 class="text-sm sm:text-base font-bold text-ayni-espresso mt-3 mb-1 tracking-tight">${formatInline(escaped.substring(5))}</h4>`
        );
      } else if (escaped.startsWith('### ')) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        output.push(
          `<h3 class="text-base sm:text-lg font-bold font-serif text-ayni-espresso mt-3 mb-1.5 tracking-tight flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-ayni-terracotta shrink-0"></span><span>${formatInline(escaped.substring(4))}</span></h3>`
        );
      } else if (escaped.startsWith('## ')) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        output.push(
          `<h2 class="text-lg sm:text-xl font-bold font-serif text-ayni-espresso mt-4 mb-2 pb-1 border-b border-ayni-espresso/10 tracking-tight">${formatInline(escaped.substring(3))}</h2>`
        );
      } else if (escaped.startsWith('# ')) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        output.push(
          `<h1 class="text-xl sm:text-2xl font-extrabold font-serif text-ayni-espresso mt-4 mb-2.5 tracking-tight">${formatInline(escaped.substring(2))}</h1>`
        );
      } else if (escaped.startsWith('&gt; ') || escaped.startsWith('> ')) {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        const quoteText = escaped.replace(/^(&gt;|>)\s*/, '');
        output.push(
          `<blockquote class="border-l-3 border-ayni-terracotta bg-ayni-card/80 pl-3.5 py-2 my-2 rounded-r-xl italic text-xs sm:text-sm text-ayni-muted">${formatInline(quoteText)}</blockquote>`
        );
      } else if (/^[-*]\s+/.test(escaped)) {
        if (!inList) {
          output.push('<ul class="my-2.5 space-y-1.5 bg-ayni-canvas/60 p-3 sm:p-3.5 rounded-xl border border-ayni-espresso/10">');
          inList = true;
        }
        const itemContent = escaped.replace(/^[-*]\s+/, '');
        output.push(`
          <li class="flex items-start gap-2.5 text-xs sm:text-sm text-ayni-espresso/90 leading-relaxed">
            <span class="w-1.5 h-1.5 rounded-full bg-ayni-terracotta mt-2 shrink-0"></span>
            <div class="flex-1">${formatInline(itemContent)}</div>
          </li>
        `);
      } else {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        output.push(`<p class="text-sm sm:text-base leading-relaxed text-ayni-muted my-1.5">${formatInline(escaped)}</p>`);
      }
    }

    if (inList) {
      output.push('</ul>');
    }

    return output.join('\n');
  }
}
