// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Web3Service } from './web3.service';
import { AuthVerifyResponse, SiweNonceResponse, UserSession } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly web3 = inject(Web3Service);
  private readonly apiUrl = 'http://localhost:5000/api';

  // Vanilla Signals
  public readonly currentUser = signal<UserSession | null>(null);
  public readonly token = signal<string | null>(null);
  public readonly isAuthenticating = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());
  public readonly isSeller = computed(() => this.currentUser()?.role === 'Seller');
  public readonly walletAddress = computed(
    () => this.currentUser()?.address || this.currentUser()?.walletAddress || this.web3.account()
  );

  public async connectAndAuthenticate(): Promise<boolean> {
    return this.loginWithSiwe();
  }

  public disconnect(): void {
    this.logout();
  }

  constructor() {
    // Restore session from localStorage if available
    const savedToken = localStorage.getItem('ayni_jwt_token');
    const savedUser = localStorage.getItem('ayni_user_session');

    if (savedToken && savedUser) {
      try {
        this.token.set(savedToken);
        this.currentUser.set(JSON.parse(savedUser));
      } catch {
        this.logout();
      }
    }
  }

  public async loginWithSiwe(): Promise<boolean> {
    this.isAuthenticating.set(true);
    this.error.set(null);

    try {
      // 1. Connect wallet if not already connected
      let address = this.web3.account();
      if (!address) {
        address = await this.web3.connectWallet();
      }

      if (!address) {
        throw new Error('No se pudo obtener la dirección de la billetera.');
      }

      // 2. Request SIWE Nonce from Backend
      const nonceRes = await firstValueFrom(
        this.http.get<SiweNonceResponse>(`${this.apiUrl}/auth/nonce?address=${address}`)
      );

      // 3. Create SIWE message conforming to EIP-4361
      const siweMessage =
        `Ayni Trust Marketplace Sign-In\n` +
        `Address: ${address}\n` +
        `Nonce: ${nonceRes.nonce}\n` +
        `Chain ID: 133\n` +
        `Issued At: ${new Date().toISOString()}`;

      // 4. Sign message with wallet
      const signature = await this.web3.signMessage(siweMessage);

      // 5. Verify signature at backend
      const verifyRes = await firstValueFrom(
        this.http.post<AuthVerifyResponse>(`${this.apiUrl}/auth/verify`, {
          address: address,
          message: siweMessage,
          signature: signature,
        })
      );

      // 6. Store JWT and User Session
      this.token.set(verifyRes.token);
      this.currentUser.set(verifyRes.user);

      localStorage.setItem('ayni_jwt_token', verifyRes.token);
      localStorage.setItem('ayni_user_session', JSON.stringify(verifyRes.user));

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error durante la autenticación SIWE';
      this.error.set(msg);
      return false;
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  public logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
    this.error.set(null);
    localStorage.removeItem('ayni_jwt_token');
    localStorage.removeItem('ayni_user_session');
    this.web3.disconnect();
  }
}
