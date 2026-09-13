// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, signal, effect } from '@angular/core';
import QRCode from 'qrcode';

@Component({
  selector: 'ayni-qr-code',
  standalone: true,
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCodeComponent {
  public readonly data = input.required<string>();
  public readonly size = input<number>(220);
  public readonly alt = input<string>('Safe Meet QR Code');

  public readonly qrDataUrl = signal<string | null>(null);
  public readonly isError = signal<boolean>(false);

  constructor() {
    effect(() => {
      const payload = this.data();
      const currentSize = this.size();
      if (!payload) {
        this.qrDataUrl.set(null);
        return;
      }

      QRCode.toDataURL(payload, {
        width: currentSize,
        margin: 2,
        color: {
          dark: '#0B0D17', // Aguayo deep
          light: '#F8FAFC', // Cream surface
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => {
          this.qrDataUrl.set(url);
          this.isError.set(false);
        })
        .catch(() => {
          this.isError.set(true);
        });
    });
  }
}
