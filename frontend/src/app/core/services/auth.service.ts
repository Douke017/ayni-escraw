// SPDX-License-Identifier: MIT
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Web3Service } from './web3.service';
import { AuthVerifyResponse, SiweNonceResponse, UserSession } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly web3 = inject(Web3Service);
  private readonly apiUrl = environment.apiBaseUrl;

  // Vanilla Signals
  public readonly currentUser = signal<UserSession | null>(null);
  public readonly token = signal<string | null>(null);
  public readonly isAuthenticating = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly isAuthenticated = computed(() => {
    return !!this.walletAddress() || (!!this.token() && !!this.currentUser());
  });
  public readonly isSeller = computed(() => this.currentUser()?.role === 'Seller');
  public readonly walletAddress = computed(
    () => this.web3.account() || this.currentUser()?.address || this.currentUser()?.walletAddress || null
  );

  public async connectAndAuthenticate(): Promise<boolean> {
    return this.loginWithSiwe();
  }

  public disconnect(): void {
    this.logout();
  }

  constructor() {
    // 1. Restore session from localStorage if available
    const savedToken = localStorage.getItem('ayni_jwt_token');
    const savedUser = localStorage.getItem('ayni_user_session');

    if (savedToken && savedUser) {
      try {
        this.token.set(savedToken);
        this.currentUser.set(JSON.parse(savedUser));
      } catch {
        this.logout();
      }
    } else {
      // 2. If wallet address was previously saved, restore direct Web3 session
      const savedAddress = localStorage.getItem('ayni_wallet_address');
      if (savedAddress && savedAddress.startsWith('0x')) {
        const addr = savedAddress.toLowerCase();
        this.currentUser.set({
          id: addr,
          address: addr,
          walletAddress: addr,
          role: 'Buyer',
        });
        this.token.set(`web3_session_${addr}`);
      }
    }
  }

  public async loginWithSiwe(): Promise<boolean> {
    this.isAuthenticating.set(true);
    this.error.set(null);

    try {
      // 1. Connect wallet via Web3 provider
      let address = this.web3.account();
      if (!address) {
        address = await this.web3.connectWallet();
      }

      if (!address) {
        throw new Error('No se pudo obtener la dirección de la billetera.');
      }

      // Establish immediate Web3 user session
      const fallbackUser: UserSession = {
        id: address,
        address: address,
        walletAddress: address,
        role: 'Buyer',
      };
      this.currentUser.set(fallbackUser);
      localStorage.setItem('ayni_user_session', JSON.stringify(fallbackUser));

      // 2. Attempt backend SIWE (EIP-4361) if backend API is reachable
      try {
        const nonceRes = await firstValueFrom(
          this.http.get<SiweNonceResponse>(`${this.apiUrl}/auth/nonce?address=${address}`)
        );

        const siweMessage =
          `Ayni Marketplace Sign-In\n` +
          `Address: ${address}\n` +
          `Nonce: ${nonceRes.nonce}\n` +
          `Chain ID: ${environment.chainId}\n` +
          `Issued At: ${new Date().toISOString()}`;

        const signature = await this.web3.signMessage(siweMessage);

        const verifyRes = await firstValueFrom(
          this.http.post<AuthVerifyResponse>(`${this.apiUrl}/auth/verify`, {
            address: address,
            message: siweMessage,
            signature: signature,
          })
        );

        this.token.set(verifyRes.token);
        this.currentUser.set(verifyRes.user);

        localStorage.setItem('ayni_jwt_token', verifyRes.token);
        localStorage.setItem('ayni_user_session', JSON.stringify(verifyRes.user));
      } catch (backendErr: unknown) {
        console.warn('Backend SIWE no disponible; operando en modo Web3 descentralizado directo:', backendErr);
        this.token.set(`web3_session_${address}`);
        localStorage.setItem('ayni_jwt_token', `web3_session_${address}`);
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar la billetera Web3';
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
