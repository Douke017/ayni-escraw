// SPDX-License-Identifier: MIT
import { Injectable, signal, computed } from '@angular/core';
import { createPublicClient, http, defineChain, parseAbi, formatUnits, keccak256, toHex, encodeFunctionData, type PublicClient, type Address } from 'viem';
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

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);
const ERC20_BALANCE_ABI = ERC20_ABI;

export const AYNI_ESCROW_ABI = [
  {
    type: 'function',
    name: 'createOrder',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'seller', type: 'address' },
      { name: 'arbitrator', type: 'address' },
      { name: 'passportTokenId', type: 'uint256' },
      { name: 'amountUsdt', type: 'uint256' },
      { name: 'validatedAgentId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositDirect',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'confirmHandoff',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleOrder',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getOrder',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'orderId', type: 'bytes32' },
          { name: 'buyer', type: 'address' },
          { name: 'seller', type: 'address' },
          { name: 'arbitrator', type: 'address' },
          { name: 'passportTokenId', type: 'uint256' },
          { name: 'amountUsdt', type: 'uint256' },
          { name: 'inspectionDeadline', type: 'uint256' },
          { name: 'validatedAgentId', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

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
      transport: http(environment.rpcUrl),
    });

    // Setup event listeners for MetaMask
    if (typeof window !== 'undefined') {
      const ethereum = (window as unknown as {
        ethereum?: {
          on?: (event: string, callback: (...args: unknown[]) => void) => void;
          request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
      }).ethereum;

      if (ethereum?.on) {
        ethereum.on('accountsChanged', (accounts: unknown) => {
          const accs = accounts as string[];
          if (accs && accs.length > 0) {
            const nextAddr = accs[0].toLowerCase() as Address;
            this.account.set(nextAddr);
            localStorage.setItem('ayni_wallet_address', nextAddr);
            this.refreshUsdtBalance();
          } else {
            this.account.set(null);
            this.balanceUsdt.set('0.00');
            localStorage.removeItem('ayni_wallet_address');
          }
        });

        ethereum.on('chainChanged', (chainIdHex: unknown) => {
          const cid = parseInt(chainIdHex as string, 16);
          this.chainId.set(cid);
          this.refreshUsdtBalance();
        });
      }
    }

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
      console.log(`[Ayni Web3] USDT Balance for ${addr}: ${formatted}`);
    } catch (err: unknown) {
      console.warn('[Ayni Web3] Public RPC readContract failed, trying fallback eth_call:', err);
      try {
        const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
        if (ethereum) {
          const cleanAddr = addr.replace(/^0x/, '').padStart(64, '0');
          const data = `0x70a08231${cleanAddr}`;
          const res = (await ethereum.request({
            method: 'eth_call',
            params: [{ to: usdtContract, data }, 'latest'],
          })) as string;
          if (res && res !== '0x') {
            const raw = BigInt(res);
            const formatted = formatUnits(raw, 6);
            this.balanceUsdt.set(formatted);
            console.log(`[Ayni Web3] Fallback USDT Balance for ${addr}: ${formatted}`);
          }
        }
      } catch (fallbackErr) {
        console.error('[Ayni Web3] Failed to query USDT balance:', fallbackErr);
      }
    }
  }

  private isWatchAssetInProgress = false;
  public async addUsdtToMetaMask(): Promise<boolean> {
    if (this.isWatchAssetInProgress) return false;
    this.isWatchAssetInProgress = true;
    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown }) => Promise<unknown> } }).ethereum;
      if (!ethereum) return false;
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: environment.contracts.usdt,
            symbol: 'USDT',
            decimals: 6,
            image: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
          },
        },
      });
      return true;
    } catch (err) {
      console.error('Failed to add token to MetaMask', err);
      return false;
    } finally {
      this.isWatchAssetInProgress = false;
    }
  }

  private isFaucetInProgress = false;
  public async requestFaucet(amount: number = 1000): Promise<string | null> {
    if (this.isFaucetInProgress) return null;
    const addr = this.account();
    const usdtContract = environment.contracts.usdt;
    if (!addr || !usdtContract) return null;

    this.isFaucetInProgress = true;
    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error('Billetera Web3 no disponible');

      const cleanAddr = addr.replace(/^0x/, '').padStart(64, '0');
      const amountHex = (BigInt(amount) * 1000000n).toString(16).padStart(64, '0');
      const data = `0x7b56c2b2${cleanAddr}${amountHex}`;

      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: addr,
            to: usdtContract,
            data: data,
          },
        ],
      })) as string;

      setTimeout(() => this.refreshUsdtBalance(), 4000);
      return txHash;
    } catch (err) {
      console.error('Faucet request failed:', err);
      throw err;
    } finally {
      this.isFaucetInProgress = false;
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

  public async ensureUsdtAllowance(spender: Address, requiredAmount: bigint): Promise<string | null> {
    const addr = this.account();
    const usdtContract = environment.contracts.usdt as Address;
    if (!addr || !usdtContract) return null;

    try {
      const currentAllowance = await this.publicClient.readContract({
        address: usdtContract,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [addr, spender],
      });

      if (currentAllowance >= requiredAmount) {
        console.log(`[Ayni Web3] Allowance already sufficient: ${currentAllowance} >= ${requiredAmount}`);
        return null;
      }

      console.log(`[Ayni Web3] Requesting USDT approval for spender ${spender}: required ${requiredAmount}, current ${currentAllowance}`);
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error('Billetera Web3 no disponible.');

      const cleanSpender = spender.replace(/^0x/, '').padStart(64, '0');
      // Unlimited approve (2^256 - 1) for seamless user experience
      const maxUint256Hex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const data = `0x095ea7b3${cleanSpender}${maxUint256Hex}`;

      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: addr,
            to: usdtContract,
            data: data,
          },
        ],
      })) as string;

      console.log(`[Ayni Web3] USDT approval transaction sent: ${txHash}`);
      await new Promise((resolve) => setTimeout(resolve, 3500));
      return txHash;
    } catch (err: unknown) {
      console.error('[Ayni Web3] Failed to ensure USDT allowance:', err);
      throw err;
    }
  }

  public async depositChatBondOnChain(orderId: string, seller: Address): Promise<string> {
    const addr = this.account();
    const chatBondContract = environment.contracts.chatBond as Address;
    if (!addr || !chatBondContract) {
      throw new Error('Billetera o contrato de ChatBond no disponible.');
    }

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) throw new Error('Billetera Web3 no disponible.');

    // 32-byte chatId computed from orderId
    const chatIdHex = keccak256(toHex(orderId)).replace(/^0x/, '');
    const cleanSeller = seller.replace(/^0x/, '').padStart(64, '0');
    // Function selector for openChatBond(bytes32,address) is 0x9114ad66
    const data = `0x9114ad66${chatIdHex}${cleanSeller}`;

    console.log(`[Ayni Web3] Depositing 0.30 USDT chat bond on-chain to ${chatBondContract}`);
    const txHash = (await ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: addr,
          to: chatBondContract,
          data: data,
        },
      ],
    })) as string;

    console.log(`[Ayni Web3] Chat bond transaction sent: ${txHash}`);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return txHash;
  }

  public async signPermit2Witness(params: {
    token: Address;
    spender: Address;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
    orderId: string;
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

    // Ensure orderId is formatted as a 32-byte hex string (bytes32, 66 chars with 0x)
    let formattedOrderId = params.orderId.trim();
    if (!formattedOrderId.startsWith('0x')) {
      formattedOrderId = '0x' + formattedOrderId;
    }
    formattedOrderId = formattedOrderId.padEnd(66, '0').slice(0, 66);

    const typedData = {
      types: {
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        AyniEscrowWitness: [
          { name: 'orderId', type: 'bytes32' },
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
          orderId: formattedOrderId,
          buyer: params.buyer,
          seller: params.seller,
        },
      },
    };

    console.log('[Ayni Web3] Requesting Permit2 EIP-712 signature for:', addr, typedData);

    const signature = (await ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [addr, JSON.stringify(typedData)],
    })) as string;

    return signature;
  }

  public toBytes32(value: string): `0x${string}` {
    const trimmed = value.trim();
    if (trimmed.startsWith('0x') && trimmed.length === 66) {
      return trimmed as `0x${string}`;
    }
    return keccak256(toHex(trimmed));
  }

  public async getOrderOnChain(orderId: string): Promise<{
    orderId: `0x${string}`;
    buyer: Address;
    seller: Address;
    arbitrator: Address;
    passportTokenId: bigint;
    amountUsdt: bigint;
    inspectionDeadline: bigint;
    validatedAgentId: bigint;
    status: number;
  } | null> {
    const escrowContract = environment.contracts.escrow as Address;
    if (!escrowContract) return null;
    const orderBytes32 = this.toBytes32(orderId);

    try {
      const order = await this.publicClient.readContract({
        address: escrowContract,
        abi: AYNI_ESCROW_ABI,
        functionName: 'getOrder',
        args: [orderBytes32],
      });
      return order as unknown as {
        orderId: `0x${string}`;
        buyer: Address;
        seller: Address;
        arbitrator: Address;
        passportTokenId: bigint;
        amountUsdt: bigint;
        inspectionDeadline: bigint;
        validatedAgentId: bigint;
        status: number;
      };
    } catch (err) {
      console.warn('[Ayni Web3] Failed to read on-chain order or does not exist:', err);
      return null;
    }
  }

  public async createAndDepositEscrow(params: {
    orderId: string;
    seller: Address;
    amountUsdt: number;
    passportTokenId?: number;
    validatedAgentId?: number;
    arbitrator?: Address;
  }): Promise<{ txHash: string; onChainOrderId: `0x${string}` }> {
    const addr = this.account();
    const escrowContract = environment.contracts.escrow as Address;
    const usdtContract = environment.contracts.usdt as Address;
    if (!addr || !escrowContract || !usdtContract) {
      throw new Error('Billetera o contratos de Escrow/USDT no disponibles.');
    }

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) throw new Error('Billetera Web3 no disponible.');

    const onChainOrderId = this.toBytes32(params.orderId);
    const amountUnits = BigInt(Math.round(params.amountUsdt * 1e6));
    const arbitrator = params.arbitrator || ('0x6582dCD2587C6094C0Fb3ce986035B1a4157D59a' as Address);
    const validatedAgentId = BigInt(params.validatedAgentId || 1);

    // Map passport tokenId: 4 for seller 0x9965, 1 for 0x7099, 3 for 0x6582, or fallback 4
    let passportTokenId = BigInt(params.passportTokenId || 4);
    if (params.seller.toLowerCase() === '0x70997970c51812dc3a010c7d01b50e0d17dc79c8') {
      passportTokenId = 1n;
    } else if (params.seller.toLowerCase() === '0x6582dcd2587c6094c0fb3ce986035b1a4157d59a') {
      passportTokenId = 3n;
    } else if (params.seller.toLowerCase() === '0x9965507d1a55bcc2695c58ba16fb37d819b0a4df') {
      passportTokenId = 4n;
    }

    // Step 1: Ensure USDT allowance to AyniEscrow contract
    console.log(`[Ayni Web3] Ensuring USDT allowance to escrow ${escrowContract}...`);
    await this.ensureUsdtAllowance(escrowContract, amountUnits);

    // Step 2: Check if order already created on-chain
    const existing = await this.getOrderOnChain(onChainOrderId);
    if (!existing || existing.buyer === '0x0000000000000000000000000000000000000000') {
      console.log(`[Ayni Web3] Creating on-chain order ${onChainOrderId}...`);
      const createData = encodeFunctionData({
        abi: AYNI_ESCROW_ABI,
        functionName: 'createOrder',
        args: [onChainOrderId, params.seller, arbitrator, passportTokenId, amountUnits, validatedAgentId],
      });

      const createTxHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: addr,
            to: escrowContract,
            data: createData,
          },
        ],
      })) as string;

      console.log(`[Ayni Web3] createOrder sent: ${createTxHash}`);
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }

    // Step 3: Deposit USDT directly into Escrow (atomic ERC-20 transferFrom deducting tokens on-chain!)
    console.log(`[Ayni Web3] Depositing ${params.amountUsdt} USDT into escrow...`);
    const depositData = encodeFunctionData({
      abi: AYNI_ESCROW_ABI,
      functionName: 'depositDirect',
      args: [onChainOrderId],
    });

    const depositTxHash = (await ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: addr,
          to: escrowContract,
          data: depositData,
        },
      ],
    })) as string;

    console.log(`[Ayni Web3] depositDirect sent: ${depositTxHash}`);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await this.refreshUsdtBalance();

    return { txHash: depositTxHash, onChainOrderId };
  }

  public async confirmHandoffOnChain(orderId: string): Promise<string> {
    const addr = this.account();
    const escrowContract = environment.contracts.escrow as Address;
    if (!addr || !escrowContract) throw new Error('Billetera o contrato de custodia no disponible.');

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) throw new Error('Billetera Web3 no disponible.');

    const onChainOrderId = this.toBytes32(orderId);
    const existing = await this.getOrderOnChain(onChainOrderId);
    if (existing && existing.status >= 3) {
      console.log(`[Ayni Web3] Order ${onChainOrderId} already in inspection window or settled (status: ${existing.status}).`);
      return '';
    }

    const handoffData = encodeFunctionData({
      abi: AYNI_ESCROW_ABI,
      functionName: 'confirmHandoff',
      args: [onChainOrderId],
    });

    console.log(`[Ayni Web3] Confirming handoff on-chain for ${onChainOrderId}...`);
    const txHash = (await ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: addr,
          to: escrowContract,
          data: handoffData,
        },
      ],
    })) as string;

    console.log(`[Ayni Web3] confirmHandoff tx: ${txHash}`);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return txHash;
  }

  public async settleOrderOnChain(orderId: string): Promise<string> {
    const addr = this.account();
    const escrowContract = environment.contracts.escrow as Address;
    if (!addr || !escrowContract) throw new Error('Billetera o contrato de custodia no disponible.');

    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) throw new Error('Billetera Web3 no disponible.');

    const onChainOrderId = this.toBytes32(orderId);
    const existing = await this.getOrderOnChain(onChainOrderId);

    // If order is still in FUNDED (status 1), auto-confirm handoff first so it enters INSPECTION_WINDOW (status 3)
    if (existing && existing.status === 1) {
      console.log(`[Ayni Web3] Order status is FUNDED (1). Auto-confirming handoff before early settlement...`);
      await this.confirmHandoffOnChain(orderId);
    }

    console.log(`[Ayni Web3] Settling order on-chain for ${onChainOrderId}...`);
    const settleData = encodeFunctionData({
      abi: AYNI_ESCROW_ABI,
      functionName: 'settleOrder',
      args: [onChainOrderId],
    });

    const txHash = (await ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: addr,
          to: escrowContract,
          data: settleData,
        },
      ],
    })) as string;

    console.log(`[Ayni Web3] settleOrder tx: ${txHash}`);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await this.refreshUsdtBalance();
    return txHash;
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
