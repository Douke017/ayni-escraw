// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { Web3Service } from '../../../core/services/web3.service';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';

interface InspectionItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

@Component({
  selector: 'ayni-video-verify',
  standalone: true,
  imports: [
    FormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
  ],
  templateUrl: './video-verify.component.html',
  styleUrl: './video-verify.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoVerifyComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly escrowService = inject(EscrowStateService);
  protected readonly signalR = inject(SignalRService);
  protected readonly web3Service = inject(Web3Service);

  @ViewChild('localVideo')
  public set localVideoRef(el: ElementRef<HTMLVideoElement> | undefined) {
    if (el?.nativeElement && this.localStream) {
      el.nativeElement.srcObject = this.localStream;
    }
  }

  public readonly orderId = signal<string>('');
  public readonly isCallActive = signal<boolean>(true);
  public readonly isAudioMuted = signal<boolean>(false);
  public readonly isVideoMuted = signal<boolean>(false);

  public readonly isRequestingMedia = signal<boolean>(false);
  public readonly mediaPermissionGranted = signal<boolean>(false);
  public readonly mediaError = signal<string | null>(null);

  public readonly isReleasing = signal<boolean>(false);
  public readonly settlementTxHash = signal<string | null>(null);

  public localStream: MediaStream | null = null;

  public readonly checklist = signal<InspectionItem[]>([
    {
      id: 'screen',
      label: 'Pantalla & Táctil',
      description: 'Sin fracturas, pixeles muertos ni tintes en blanco puro.',
      checked: true,
    },
    {
      id: 'cameras',
      label: 'Cámaras & Sensores',
      description: 'Enfoque nítido en lente principal, angular y selfie.',
      checked: true,
    },
    {
      id: 'ports',
      label: 'Puertos & Conectividad',
      description: 'Carga normal, reconocimiento de cables y Wi-Fi/Bluetooth.',
      checked: false,
    },
    {
      id: 'battery',
      label: 'Salud de Batería Real',
      description: 'Comprobada en el menú de ajustes o software diagnóstico.',
      checked: false,
    },
    {
      id: 'commitment',
      label: 'Salted IMEI Keccak256',
      description: 'El hash calculado con el salt coincide con el registro del pasaporte.',
      checked: false,
    },
  ]);

  public readonly checkedCount = computed(() => this.checklist().filter((i) => i.checked).length);

  public async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('orderId');
    if (id) {
      this.orderId.set(id);
      await this.escrowService.fetchOrderById(id);
    }

    await this.startMediaSession();
  }

  public ngOnDestroy(): void {
    this.stopMediaStream();
  }

  public async startMediaSession(): Promise<void> {
    this.isRequestingMedia.set(true);
    this.mediaError.set(null);

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        this.localStream = stream;
        this.mediaPermissionGranted.set(true);
        this.isCallActive.set(true);
        console.log('[Ayni VideoVerify] Real camera and microphone access granted.');
      } else {
        throw new Error('Dispositivo o navegador sin soporte para getUserMedia');
      }
    } catch (err: unknown) {
      console.warn('[Ayni VideoVerify] Camera/Mic access denied or unavailable:', err);
      this.mediaPermissionGranted.set(false);
      this.mediaError.set('Acceso a cámara/micrófono no concedido o no disponible.');
    } finally {
      this.isRequestingMedia.set(false);
    }
  }

  private stopMediaStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  public toggleCheck(item: InspectionItem): void {
    this.checklist.update((items) =>
      items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
    );
  }

  public allChecked(): boolean {
    return this.checklist().every((i) => i.checked);
  }

  public toggleAudio(): void {
    this.isAudioMuted.update((v) => !v);
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isAudioMuted();
      });
    }
  }

  public toggleVideo(): void {
    this.isVideoMuted.update((v) => !v);
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !this.isVideoMuted();
      });
    }
  }

  public endCall(): void {
    this.stopMediaStream();
    this.isCallActive.set(false);
  }

  public async restartCall(): Promise<void> {
    this.isCallActive.set(true);
    await this.startMediaSession();
  }

  public async onReleaseFunds(): Promise<void> {
    if (!this.orderId() || this.isReleasing()) return;

    this.isReleasing.set(true);
    try {
      const order = this.escrowService.currentOrder();
      const onChainId = order?.onChainOrderId || this.orderId();

      console.log(`[Ayni VideoVerify] Executing on-chain settlement for order ${onChainId}...`);
      // Step 1: Call settleOrder on AyniEscrow via MetaMask!
      // This transfers USDT to seller, transfers Passport NFT to buyer, and records reputation.
      const txHash = await this.web3Service.settleOrderOnChain(onChainId);
      this.settlementTxHash.set(txHash);

      // Step 2: Settle on backend DB and trigger SignalR notifications
      await this.escrowService.releaseFunds(this.orderId(), txHash);

      alert(`¡Inspección aprobada y fondos liquidados con éxito en HSK Chain!\n\nTxHash: ${txHash}\nTokens USDT transferidos al vendedor y Pasaporte NFT transferido al comprador.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al liquidar fondos en HSK Chain.';
      console.error('[Ayni VideoVerify] Settlement failed:', err);
      alert(msg);
    } finally {
      this.isReleasing.set(false);
    }
  }

  public async onRaiseDispute(): Promise<void> {
    if (!this.orderId()) return;
    const reason = prompt('Indica el motivo de la discrepancia de hardware:') || 'Discrepancia técnica';
    try {
      await this.escrowService.raiseDispute(this.orderId(), reason);
      alert('Disputa registrada. El árbitro 2-de-3 evaluará la evidencia.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al abrir disputa.';
      alert(msg);
    }
  }
}
