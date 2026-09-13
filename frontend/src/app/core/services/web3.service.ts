// SPDX-License-Identifier: MIT
import { Injectable, signal, computed } from '@angular/core';
import { createPublicClient, http, defineChain, parseAbi, formatUnits, type PublicClient, type Address } from 'viem';
import { environment } from '../../../environments/environment';

export const hskTestnet = defineChain({
  id: environment.chainId,
  name: environment.chainName,
  nativeCurrency: { name: 'HashKey EcoPoints', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: [environment.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'HSK Explorer', url: environment.blockExplorerUrl },
  },
  testnet: true,
});

const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

@Injectable({
  providedIn: 'root',
})
export class Web3Service {
  public readonly publicClient: PublicClient;

  // Vanilla Angular 22 Signals
  public readonly account = signal<Address | null>(null);
  public readonly chainId = signal<number | null>(null);
  public readonly isConnecting = signal<boolean>(false);
  public readonly balanceUsdt = signal<string>('0.00');
  public readonly error = signal<string | null>(null);

  // Computed signals
  public readonly isConnected = computed(() => this.account() !== null);
  public readonly isHskChain = computed(() => this.chainId() === environment.chainId);
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
      this.chainId.set(environment.chainId);
      this.refreshUsdtBalance();
    }
  }

  public async connectWallet(): Promise<Address | null> {
    this.isConnecting.set(true);
    this.error.set(null);

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

      if (!ethereum) {
        throw new Error('Billetera Web3 no encontrada. Por favor instala MetaMask, Rabby u otra extensión compatible con EVM para continuar.');
      }

      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No se seleccionó ninguna cuenta en la billetera.');
      }

      const addr = accounts[0].toLowerCase() as Address;
      this.account.set(addr);
      this.chainId.set(environment.chainId);
      localStorage.setItem('ayni_wallet_address', addr);

      await this.refreshUsdtBalance();
      return addr;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar la billetera Web3';
      this.error.set(msg);
      return null;
    } finally {
      this.isConnecting.set(false);
    }
  }

  public async refreshUsdtBalance(): Promise<void> {
    const addr = this.account();
    const usdtContract = environment.contracts.usdt;
    if (!addr || !usdtContract || !usdtContract.startsWith('0x')) {
      return;
    }

    try {
      const balance = await this.publicClient.readContract({
        address: usdtContract as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [addr],
      });
      const formatted = formatUnits(balance, 6);
      this.balanceUsdt.set(formatted);
    } catch {
      // Keep existing balance if contract query fails
    }
  }

  public async signMessage(message: string): Promise<string> {
    const addr = this.account();
    if (!addr) {
      throw new Error('No hay billetera conectada para firmar.');
    }

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

    if (!ethereum) {
      throw new Error('Proveedor Web3 no disponible en el navegador.');
    }

    try {
      const sig = (await ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      })) as string;
      return sig;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Firma rechazada por el usuario';
      this.error.set(msg);
      throw err;
    }
  }

  public async signPermit2Witness(params: {
    token: Address;
    spender: Address;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
    orderId: bigint;
    buyer: Address;
    seller: Address;
  }): Promise<string> {
    const addr = this.account();
    if (!addr) {
      throw new Error('No hay billetera conectada para firmar Permit2.');
    }

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      throw new Error('Proveedor Web3 no disponible en el navegador.');
    }

    const permit2Address = environment.contracts.permit2;

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        AyniEscrowWitness: [
          { name: 'orderId', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'seller', type: 'address' },
        ],
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'witness', type: 'AyniEscrowWitness' },
        ],
      },
      primaryType: 'PermitWitnessTransferFrom',
      domain: {
        name: 'Permit2',
        chainId: environment.chainId,
        verifyingContract: permit2Address,
      },
      message: {
        permitted: {
          token: params.token,
          amount: params.amount.toString(),
        },
        spender: params.spender,
        nonce: params.nonce.toString(),
        deadline: params.deadline.toString(),
        witness: {
          orderId: params.orderId.toString(),
          buyer: params.buyer,
          seller: params.seller,
        },
      },
    };

    const signature = (await ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [addr, JSON.stringify(typedData)],
    })) as string;

    return signature;
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
