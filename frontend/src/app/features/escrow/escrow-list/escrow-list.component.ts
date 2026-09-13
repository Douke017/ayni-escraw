// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EscrowStateService } from '../../../core/services/escrow-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { EscrowOrder, OrderStatus } from '../../../core/models/order.model';
import { BadgeComponent, BadgeVariant } from '../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { UsdtPipe } from '../../../shared/pipes/usdt.pipe';
import { TruncateAddressPipe } from '../../../shared/pipes/truncate-address.pipe';

@Component({
  selector: 'ayni-escrow-list',
  standalone: true,
  imports: [
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    UsdtPipe,
    TruncateAddressPipe,
  ],
  templateUrl: './escrow-list.component.html',
  styleUrl: './escrow-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscrowListComponent implements OnInit {
  protected readonly escrowService = inject(EscrowStateService);
  protected readonly authService = inject(AuthService);

  public ngOnInit(): void {
    this.escrowService.fetchOrders();
  }

  public getStatusVariant(status: OrderStatus): BadgeVariant {
    switch (status) {
      case OrderStatus.Created:
        return 'neutral';
      case OrderStatus.Funded:
        return 'funded';
      case OrderStatus.HandoffConfirmed:
      case OrderStatus.InspectionWindow:
        return 'warn';
      case OrderStatus.Settled:
        return 'pass';
      case OrderStatus.Disputed:
        return 'fail';
      case OrderStatus.Refunded:
        return 'refund';
      default:
        return 'neutral';
    }
  }

  public getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Created:
        return 'Esperando Depósito';
      case OrderStatus.Funded:
        return 'Fondos en Escrow (Permit2)';
      case OrderStatus.HandoffConfirmed:
        return 'Safe Meet Confirmado';
      case OrderStatus.InspectionWindow:
        return 'Ventana de Inspección (24h)';
      case OrderStatus.Settled:
        return 'Liquidado Exitosamente';
      case OrderStatus.Disputed:
        return 'En Disputa Multisig 2/3';
      case OrderStatus.Refunded:
        return 'Reembolsado al Comprador';
      default:
        return 'Desconocido';
    }
  }
}
