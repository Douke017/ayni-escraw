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
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly isConnected = computed(() => this.account() !== null);
  public readonly isHskChain = computed(() => this.chainId() === hskTestnet.id);

  constructor() {
    this.publicClient = createPublicClient({
      chain: hskTestnet,
      transport: http(),
    });
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
  }
}
