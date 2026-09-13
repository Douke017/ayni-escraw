import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

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
    CommonModule,
    FormsModule,
    BadgeComponent,
    ButtonComponent,
],
  templateUrl: './video-verify.component.html',
  styleUrl: './video-verify.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoVerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly escrowService = inject(EscrowStateService);
  protected readonly signalR = inject(SignalRService);

  public readonly orderId = signal<string>('');
  public readonly isCallActive = signal<boolean>(true);
  public readonly isAudioMuted = signal<boolean>(false);
  public readonly isVideoMuted = signal<boolean>(false);

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

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('orderId');
    if (id) {
      this.orderId.set(id);
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
  }

  public toggleVideo(): void {
    this.isVideoMuted.update((v) => !v);
  }

  public async onReleaseFunds(): Promise<void> {
    if (!this.orderId()) return;
    try {
      await this.escrowService.releaseFunds(this.orderId());
      alert('¡Inspección aprobada! Los fondos se han liberado al vendedor en HSK Chain.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al liberar fondos.';
      alert(msg);
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
