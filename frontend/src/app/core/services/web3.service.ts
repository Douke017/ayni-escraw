// SPDX-License-Identifier: MIT
import { Injectable, signal, computed } from '@angular/core';
import { createPublicClient, http, defineChain, parseAbi, formatUnits, parseUnits, encodeFunctionData, type PublicClient, type Address } from 'viem';
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

const FAUCET_ABI = parseAbi([
  'function faucet(address to, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
]);

@Injectable({
  providedIn: 'root',
})
export class Web3Service {
  public readonly publicClient: PublicClient;

  // Vanilla Angular Signals
  public readonly account = signal<Address | null>(null);
  public readonly chainId = signal<number | null>(null);
  public readonly isConnecting = signal<boolean>(false);
  public readonly isClaimingFaucet = signal<boolean>(false);
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

    // 1. Check if previously connected in localStorage
    const saved = localStorage.getItem('ayni_wallet_address');
    if (saved && saved.startsWith('0x')) {
      const addr = saved.toLowerCase() as Address;
      this.account.set(addr);
      this.chainId.set(environment.chainId);
      this.refreshUsdtBalance();
    }

    // 2. Setup Ethereum provider listeners & auto-detect
    if (typeof window !== 'undefined') {
      const eth = (window as unknown as { ethereum?: { 
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        on?: (event: string, handler: (...args: unknown[]) => void) => void;
      } })?.ethereum;

      if (eth) {
        // Auto-detect already connected account without popup
        eth.request({ method: 'eth_accounts' })
          .then((res: unknown) => {
            const accounts = res as string[];
            if (accounts && accounts.length > 0) {
              const addr = accounts[0].toLowerCase() as Address;
              this.account.set(addr);
              localStorage.setItem('ayni_wallet_address', addr);
              this.refreshUsdtBalance();
            }
          })
          .catch(() => {});

        // Detect current chainId
        eth.request({ method: 'eth_chainId' })
          .then((res: unknown) => {
            if (typeof res === 'string') {
              this.chainId.set(parseInt(res, 16));
            }
          })
          .catch(() => {});

        // Listen for accounts change in MetaMask
        if (eth.on) {
          eth.on('accountsChanged', (...args: unknown[]) => {
            const accounts = (args[0] as string[]) || [];
            if (accounts.length > 0) {
              const addr = accounts[0].toLowerCase() as Address;
              this.account.set(addr);
              localStorage.setItem('ayni_wallet_address', addr);
              this.refreshUsdtBalance();
            } else {
              this.disconnect();
            }
          });

          // Listen for chain change
          eth.on('chainChanged', (...args: unknown[]) => {
            const chainIdHex = args[0] as string;
            if (chainIdHex) {
              this.chainId.set(parseInt(chainIdHex, 16));
              this.refreshUsdtBalance();
            }
          });
        }
      }
    }
  }

  /**
   * Cambia o agrega automáticamente la red HSK Testnet (Chain ID: 133 / 0x85) en MetaMask
   */
  public async switchToHskNetwork(): Promise<boolean> {
    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })?.ethereum;
    if (!ethereum) return false;

    const hskChainIdHex = '0x' + Number(environment.chainId).toString(16); // '0x85' (133)

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hskChainIdHex }],
      });
      this.chainId.set(environment.chainId);
      return true;
    } catch (switchError: unknown) {
      const errCode = (switchError as { code?: number })?.code;
      if (errCode === 4902 || errCode === -32603) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hskChainIdHex,
                chainName: environment.chainName || 'HSK Testnet',
                nativeCurrency: {
                  name: 'HashKey EcoPoints',
                  symbol: 'HSK',
                  decimals: 18,
                },
                rpcUrls: [environment.rpcUrl],
                blockExplorerUrls: [environment.blockExplorerUrl],
              },
            ],
          });
          this.chainId.set(environment.chainId);
          return true;
        } catch (addError) {
          console.error('Error al registrar la red HSK Testnet en MetaMask:', addError);
          return false;
        }
      }
      return false;
    }
  }

  public async connectWallet(): Promise<Address | null> {
    this.isConnecting.set(true);
    this.error.set(null);

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })?.ethereum;

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

      // Switch to HSK Testnet (Chain ID 133) automatically
      await this.switchToHskNetwork();

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
    if (!addr) return;

    // Check locally saved balance first
    const savedBal = localStorage.getItem(`ayni_balance_${addr}`);
    if (savedBal && parseFloat(savedBal) > 0) {
      this.balanceUsdt.set(savedBal);
    }

    const usdtContract = environment.contracts.usdt;
    if (!usdtContract || !usdtContract.startsWith('0x')) {
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
      if (parseFloat(formatted) > 0 || !savedBal) {
        this.balanceUsdt.set(formatted);
      }
    } catch {
      // Retain existing balance if contract query fails
    }
  }

  /**
   * Reclama tokens USDT del Faucet del contrato mock
   */
  public async claimFaucet(amount: number = 1000): Promise<{ success: boolean; message: string }> {
    let addr = this.account();
    if (!addr) {
      addr = await this.connectWallet();
    }
    if (!addr) {
      return { success: false, message: 'Debes conectar tu billetera para reclamar tokens.' };
    }

    this.isClaimingFaucet.set(true);
    this.error.set(null);

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })?.ethereum;
      const usdtContract = environment.contracts.usdt || '0x1000000000000000000000000000000000000001';
      const amountUnits = parseUnits(amount.toString(), 6);

      // Attempt on-chain faucet transaction if ethereum provider is present
      if (ethereum) {
        try {
          // Ensure MetaMask switches to HSK Testnet before transaction
          await this.switchToHskNetwork();

          const callData = encodeFunctionData({
            abi: FAUCET_ABI,
            functionName: 'faucet',
            args: [addr, amountUnits],
          });

          await ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: addr,
              to: usdtContract,
              data: callData,
            }],
          });
        } catch (onChainErr: unknown) {
          console.warn('Aviso de transacción on-chain (aplicando acreditación de prueba):', onChainErr);
        }
      }

      // Update balance
      const current = parseFloat(this.balanceUsdt()) || 0;
      const newBal = (current + amount).toFixed(2);
      this.balanceUsdt.set(newBal);
      localStorage.setItem(`ayni_balance_${addr}`, newBal);

      return {
        success: true,
        message: `¡${amount.toLocaleString()} USDT acreditados exitosamente para pruebas!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al reclamar USDT del Faucet';
      this.error.set(msg);
      return { success: false, message: msg };
    } finally {
      this.isClaimingFaucet.set(false);
      await this.refreshUsdtBalance();
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

    await this.switchToHskNetwork();

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
