// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserModeService } from '../../../core/services/user-mode.service';
import { KycService } from '../../../core/services/kyc.service';
import { Web3Service } from '../../../core/services/web3.service';
import { AuthService } from '../../../core/services/auth.service';
import { TruncateAddressPipe } from '../../pipes/truncate-address.pipe';
import { AguayoRibbonComponent } from '../aguayo-ribbon/aguayo-ribbon.component';

@Component({
  selector: 'ayni-kyc-bridge-modal',
  standalone: true,
  imports: [
    CommonModule,
    TruncateAddressPipe,
    AguayoRibbonComponent,
  ],
  template: `
    @if (userModeService.isKycModalOpen()) {
      <div 
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fadeIn"
        (click)="close()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-modal-title"
      >
        <div 
          class="bg-ayni-card border-2 border-ayni-gold/70 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col text-ayni-espresso relative max-h-[92vh]"
          (click)="$event.stopPropagation()"
        >
          <ayni-aguayo-ribbon size="md"></ayni-aguayo-ribbon>

          <div class="p-6 sm:p-7 flex flex-col gap-5 overflow-y-auto">
            <!-- Header -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-ayni-terracotta/15 border border-ayni-terracotta/30 flex items-center justify-center text-ayni-terracotta shrink-0 shadow-xs">
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold tracking-widest text-ayni-terracotta block">Ayni Trust Gateway</span>
                  <h3 id="kyc-modal-title" class="text-xl sm:text-2xl font-bold font-serif text-ayni-espresso leading-tight">
                    Verificación KYC para Vendedores
                  </h3>
                </div>
              </div>

              <button 
                type="button" 
                (click)="close()"
                class="w-8 h-8 rounded-full hover:bg-black/10 flex items-center justify-center text-ayni-espresso/70 hover:text-ayni-espresso transition-colors cursor-pointer shrink-0"
                aria-label="Cerrar modal"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <!-- Value Proposition Description -->
            <p class="text-xs sm:text-sm text-ayni-muted leading-relaxed">
              Para publicar y vender hardware en Ayni Marketplace, tu billetera debe contar con identidad verificada. Esto protege a los compradores, previene fraudes y habilita a tu <strong class="text-ayni-espresso">Seller Agent</strong> a negociar y cerrar ventas on-chain con custodia AyniEscrow.
            </p>

            <!-- Three Pillars of KYC -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div class="bg-ayni-canvas/60 p-3 rounded-xl border border-ayni-espresso/10 flex flex-col gap-1">
                <span class="font-bold text-ayni-espresso flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-ayni-terracotta shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>Identidad Didit</span>
                </span>
                <span class="text-[11px] text-ayni-muted leading-snug">Vínculo seguro de wallet sin exponer documentos públicos.</span>
              </div>

              <div class="bg-ayni-canvas/60 p-3 rounded-xl border border-ayni-espresso/10 flex flex-col gap-1">
                <span class="font-bold text-ayni-espresso flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  <span>Seller Agent</span>
                </span>
                <span class="text-[11px] text-ayni-muted leading-snug">Publicación autónoma 1-clic y atestación ERC-8004.</span>
              </div>

              <div class="bg-ayni-canvas/60 p-3 rounded-xl border border-ayni-espresso/10 flex flex-col gap-1">
                <span class="font-bold text-ayni-espresso flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-ayni-gold shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                  <span>Cobros USDT</span>
                </span>
                <span class="text-[11px] text-ayni-muted leading-snug">Liberación instantánea en Safe Meet QR en HSK Chain.</span>
              </div>
            </div>

            <!-- Wallet Current Status Card -->
            <div class="bg-ayni-espresso text-ayni-canvas p-4 rounded-2xl border border-ayni-gold/40 flex flex-col gap-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-ayni-gold font-bold uppercase tracking-wider text-[10px]">Billetera Conectada</span>
                <span class="text-[10px] bg-ayni-canvas/15 text-ayni-canvas px-2 py-0.5 rounded font-mono">HSK Chain Testnet</span>
              </div>
              
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs sm:text-sm font-bold text-white break-all">
                  {{ (web3Service.account() || authService.walletAddress()) | truncateAddress }}
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Estado: No Verificado
                </span>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {{ errorMessage() }}
              </div>
            }

            @if (isSuccess()) {
              <div class="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-300 flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                <div>
                  <strong class="block">¡Billetera Verificada con Éxito!</strong>
                  <span>Ahora tienes acceso completo al Modo Vendedor y al Seller Agent.</span>
                </div>
              </div>
            }

            <!-- Action Buttons -->
            <div class="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                (click)="onStartKyc()"
                [disabled]="isLoading() || isSuccess()"
                class="w-full bg-ayni-terracotta hover:bg-ayni-terracotta-hover text-white font-bold py-3.5 px-4 rounded-xl text-xs sm:text-sm transition-all duration-150 shadow-glow-terracotta flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                @if (isLoading()) {
                  <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{{ loadingStep() }}</span>
                } @else if (isSuccess()) {
                  <svg class="w-4 h-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span>Verificación Completada</span>
                } @else {
                  <svg class="w-4 h-4 text-ayni-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
                  <span>Verificar Identidad de Vendedor (KYC)</span>
                  <span aria-hidden="true">→</span>
                }
              </button>

              <!-- Continue as Buyer -->
              <button
                type="button"
                (click)="close()"
                class="text-xs text-ayni-muted hover:text-ayni-espresso text-center py-1 cursor-pointer transition-colors"
              >
                Seguir navegando como Comprador
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KycBridgeModalComponent {
  protected readonly userModeService = inject(UserModeService);
  protected readonly kycService = inject(KycService);
  protected readonly web3Service = inject(Web3Service);
  protected readonly authService = inject(AuthService);

  public readonly isLoading = signal<boolean>(false);
  public readonly loadingStep = signal<string>('Verificando identidad con Didit Protocol...');
  public readonly errorMessage = signal<string | null>(null);
  public readonly isSuccess = signal<boolean>(false);

  public close(): void {
    this.errorMessage.set(null);
    this.isSuccess.set(false);
    this.userModeService.closeKycModal();
  }

  public async onStartKyc(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadingStep.set('Generando sesión de identidad segura con Didit...');

    try {
      const wallet = this.authService.walletAddress();
      if (!wallet) {
        throw new Error('Debes conectar tu billetera antes de iniciar la verificación de identidad.');
      }

      this.loadingStep.set('Redirigiendo a Didit Verification Protocol...');
      await this.kycService.startVerificationFlow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con Didit Protocol';
      this.errorMessage.set(msg);
    } finally {
      this.isLoading.set(false);
    }
  }
}
