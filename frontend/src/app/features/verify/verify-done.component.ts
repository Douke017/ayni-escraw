// SPDX-License-Identifier: MIT
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { KycService } from '../../core/services/kyc.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-done',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-2xl mx-auto my-12 px-4">
      <div class="bg-surface rounded-2xl border border-border p-8 shadow-card text-center">
        <!-- Success State -->
        <div *ngIf="kyc.isApproved()" class="space-y-6">
          <div class="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center text-4xl text-success animate-bounce">
            ✓
          </div>
          <div>
            <h1 class="text-3xl font-display font-bold text-text-primary mb-2">
              ¡Verificación de Identidad Aprobada!
            </h1>
            <p class="text-text-secondary text-base">
              Tu identidad ha sido validada exitosamente mediante Didit KYC. Tu cuenta ahora cuenta con capacidades completas de compra y venta.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-success/10 border border-success/30 inline-flex items-center gap-3">
            <span class="w-3 h-3 rounded-full bg-success"></span>
            <span class="text-sm font-semibold text-success">
              Rol Vendedor Activo y Desbloqueado en HSK Chain
            </span>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              (click)="onStartSelling()"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg">
              📦 Publicar mi Primer Producto
            </button>
            <a
              routerLink="/catalog"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-secondary text-text-primary font-medium hover:bg-surface-secondary/80 border border-border transition">
              Explorar Marketplace
            </a>
          </div>
        </div>

        <!-- Pending State -->
        <div *ngIf="!kyc.isApproved()" class="space-y-6">
          <div class="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center text-4xl text-accent animate-pulse">
            ⏳
          </div>
          <div>
            <h1 class="text-3xl font-display font-bold text-text-primary mb-2">
              Verificación en Proceso
            </h1>
            <p class="text-text-secondary text-base">
              Didit está procesando tu documentación. Tan pronto como recibamos la confirmación del Webhook, tu rol de vendedor se activará automáticamente.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-accent/10 border border-accent/30 text-xs text-text-secondary">
            Estado actual: <strong class="text-accent">{{ kyc.kycStatus() }}</strong>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              (click)="refreshStatus()"
              [disabled]="isRefreshing()"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition">
              {{ isRefreshing() ? 'Consultando...' : '🔄 Actualizar Estado' }}
            </button>
            <a
              routerLink="/catalog"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-secondary text-text-primary font-medium hover:bg-surface-secondary/80 border border-border transition">
              Volver al Marketplace
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class VerifyDoneComponent implements OnInit {
  public readonly kyc = inject(KycService);
  public readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  public readonly isRefreshing = signal<boolean>(false);

  public async ngOnInit(): Promise<void> {
    await this.refreshStatus();
  }

  public async refreshStatus(): Promise<void> {
    this.isRefreshing.set(true);
    try {
      await this.kyc.fetchUserProfile();
    } finally {
      this.isRefreshing.set(false);
    }
  }

  public async onStartSelling(): Promise<void> {
    await this.kyc.switchRole('Seller');
    this.router.navigate(['/listings/new']);
  }
}
