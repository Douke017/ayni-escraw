// SPDX-License-Identifier: MIT
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { KycService } from '../../core/services/kyc.service';
import { AuthService } from '../../core/services/auth.service';
import { AguayoRibbonComponent } from '../../shared/components/aguayo-ribbon/aguayo-ribbon.component';

@Component({
  selector: 'app-verify-done',
  standalone: true,
  imports: [CommonModule, RouterModule, AguayoRibbonComponent],
  template: `
    <div class="py-8 sm:py-12 px-4 max-w-2xl mx-auto">
      <div class="bg-ayni-card rounded-2xl border border-ayni-gold/30 shadow-xl overflow-hidden text-center">
        <ayni-aguayo-ribbon size="md" />

        <div class="p-6 sm:p-10">
          <!-- Success State -->
          @if (kyc.isApproved()) {
            <div class="flex flex-col items-center gap-6">
              <div class="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-emerald-700 shadow-inner">
                <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>

              <div class="space-y-2">
                <h1 class="text-2xl sm:text-3xl font-black text-ayni-espresso font-serif tracking-tight">
                  Verificación de Identidad Aprobada
                </h1>
                <p class="text-xs sm:text-sm text-ayni-muted max-w-md mx-auto leading-relaxed">
                  Tu identidad ha sido validada exitosamente mediante Didit KYC. Tu cuenta ahora cuenta con capacidades completas de compra y venta en Ayni Trust Marketplace.
                </p>
              </div>

              <div class="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 inline-flex items-center gap-2.5 shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span class="text-xs font-bold text-emerald-900">
                  Rol Vendedor Activo y Desbloqueado en HSK Chain
                </span>
              </div>

              <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full">
                <button
                  type="button"
                  (click)="onStartSelling()"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-ayni-terracotta hover:bg-ayni-terracotta-hover text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="M12 5v14"/>
                  </svg>
                  <span>Publicar mi Primer Producto</span>
                </button>
                <a
                  routerLink="/catalog"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-ayni-canvas hover:bg-ayni-canvas-muted text-ayni-espresso font-bold text-xs sm:text-sm border border-ayni-espresso/15 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="7" height="7" x="3" y="3" rx="1"/>
                    <rect width="7" height="7" x="14" y="3" rx="1"/>
                    <rect width="7" height="7" x="14" y="14" rx="1"/>
                    <rect width="7" height="7" x="3" y="14" rx="1"/>
                  </svg>
                  <span>Explorar Marketplace</span>
                </a>
              </div>
            </div>
          } @else {
            <!-- Pending State -->
            <div class="flex flex-col items-center gap-6">
              <div class="w-20 h-20 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700 shadow-inner">
                <svg class="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>

              <div class="space-y-2">
                <h1 class="text-2xl sm:text-3xl font-black text-ayni-espresso font-serif tracking-tight">
                  Verificación en Proceso
                </h1>
                <p class="text-xs sm:text-sm text-ayni-muted max-w-md mx-auto leading-relaxed">
                  Didit está procesando tu documentación. Tan pronto como recibamos la confirmación del Webhook, tu rol de vendedor se activará automáticamente en la red.
                </p>
              </div>

              <div class="px-4 py-2 rounded-xl bg-ayni-canvas border border-ayni-espresso/15 text-xs text-ayni-muted">
                Estado actual: <strong class="text-amber-700 font-bold uppercase">{{ kyc.kycStatus() }}</strong>
              </div>

              <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full">
                <button
                  type="button"
                  (click)="refreshStatus()"
                  [disabled]="isRefreshing()"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-ayni-espresso hover:bg-ayni-espresso/90 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  <svg class="w-4 h-4" [class.animate-spin]="isRefreshing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                    <path d="M21 21v-5h-5"/>
                  </svg>
                  <span>{{ isRefreshing() ? 'Consultando...' : 'Actualizar Estado' }}</span>
                </button>
                <a
                  routerLink="/catalog"
                  class="w-full sm:w-auto px-6 py-3 rounded-xl bg-ayni-canvas hover:bg-ayni-canvas-muted text-ayni-espresso font-bold text-xs sm:text-sm border border-ayni-espresso/15 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>Volver al Marketplace</span>
                </a>
              </div>
            </div>
          }
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
