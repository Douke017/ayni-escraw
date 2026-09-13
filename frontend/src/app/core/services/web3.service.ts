// SPDX-License-Identifier: MIT
import { Injectable, signal, computed } from '@angular/core';
import { createPublicClient, http, defineChain, type PublicClient, type Address } from 'viem';

export const hskTestnet = defineChain({
  id: 133,
  name: 'HSK Testnet',
  nativeCurrency: { name: 'HashKey EcoPoints', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hsk.xyz'] },
  },
  blockExplorers: {
    default: { name: 'HSK Explorer', url: 'https://explorer.testnet.hsk.xyz' },
  },
  testnet: true,
});

@Injectable({
  providedIn: 'root',
})
export class Web3Service {
  public readonly publicClient: PublicClient;

  // Vanilla Angular 22 Signals
  public readonly account = signal<Address | null>(null);
  public readonly chainId = signal<number | null>(null);
  public readonly isConnecting = signal<boolean>(false);
  public readonly balanceUsdt = signal<string>('2,500.00');
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly isConnected = computed(() => this.account() !== null);
  public readonly isHskChain = computed(() => this.chainId() === hskTestnet.id);
  public readonly usdtBalance = computed(() => this.balanceUsdt());
  public readonly truncatedAddress = computed(() => {
    const addr = this.account();
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  });

  constructor() {
    this.publicClient = createPublicClient({
      chain: hskTestnet,
      transport: http(),
    });

    // Check if previously connected in localStorage
    const saved = localStorage.getItem('ayni_wallet_address');
    if (saved && saved.startsWith('0x')) {
      this.account.set(saved as Address);
      this.chainId.set(hskTestnet.id);
    }
  }

  public async connectWallet(): Promise<Address | null> {
    this.isConnecting.set(true);
    this.error.set(null);

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

      if (ethereum) {
        const accounts = (await ethereum.request({
          method: 'eth_requestAccounts',
        })) as string[];

        if (accounts && accounts.length > 0) {
          const addr = accounts[0].toLowerCase() as Address;
          this.account.set(addr);
          this.chainId.set(hskTestnet.id);
          localStorage.setItem('ayni_wallet_address', addr);
          return addr;
        }
      }

      // Fallback mock wallet for testing / sandbox environment if no browser extension injected
      const mockAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
      this.account.set(mockAddr);
      this.chainId.set(hskTestnet.id);
      localStorage.setItem('ayni_wallet_address', mockAddr);
      return mockAddr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar la billetera Web3';
      this.error.set(msg);
      return null;
    } finally {
      this.isConnecting.set(false);
    }
  }

  public async signMessage(message: string): Promise<string> {
    const addr = this.account();
    if (!addr) {
      throw new Error('No hay billetera conectada para firmar.');
    }

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

      if (ethereum) {
        const sig = (await ethereum.request({
          method: 'personal_sign',
          params: [message, addr],
        })) as string;
        return sig;
      }

      // Synthetic signature for development when browser wallet is not present
      return '0x307873796e7468657469635f7369676e61747572655f666f725f74657374696e675f61796e695f657363726f775f3230323600000000000000000000000000001b';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Firma rechazada por el usuario';
      this.error.set(msg);
      throw err;
    }
  }

  public setAccount(address: Address | null, currentChainId: number | null): void {
    this.account.set(address);
    this.chainId.set(currentChainId);
    this.error.set(null);
  }

  public disconnect(): void {
    this.account.set(null);
    this.chainId.set(null);
    this.error.set(null);
    localStorage.removeItem('ayni_wallet_address');
    localStorage.removeItem('ayni_jwt_token');
  }
}
