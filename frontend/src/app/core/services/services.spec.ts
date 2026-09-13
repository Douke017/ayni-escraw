import { describe, it, expect, beforeEach } from 'vitest';
import { Web3Service, hskTestnet } from './web3.service';
import { SignalRService } from './signalr.service';
import { EscrowStateService, EscrowUiStatus } from './escrow-state.service';

describe('Vanilla Angular 22 Signals Services', () => {
  let web3Service: Web3Service;
  let signalRService: SignalRService;
  let escrowStateService: EscrowStateService;

  beforeEach(() => {
    web3Service = new Web3Service();
    signalRService = new SignalRService();
    escrowStateService = new EscrowStateService();
  });

  describe('Web3Service Signals', () => {
    it('should initialize with disconnected state', () => {
      expect(web3Service.account()).toBeNull();
      expect(web3Service.isConnected()).toBe(false);
      expect(web3Service.isHskChain()).toBe(false);
    });

    it('should compute isConnected and isHskChain reactively when account and chainId update', () => {
      web3Service.setAccount('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 133);

      expect(web3Service.account()).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
      expect(web3Service.isConnected()).toBe(true);
      expect(web3Service.isHskChain()).toBe(true);

      // Disconnect
      web3Service.disconnect();
      expect(web3Service.account()).toBeNull();
      expect(web3Service.isConnected()).toBe(false);
    });
  });

  describe('SignalRService Signals', () => {
    it('should reactively track real-time messages and status', () => {
      expect(signalRService.messages().length).toBe(0);
      expect(signalRService.totalMessages()).toBe(0);

      signalRService.addSimulatedMessage({
        orderId: 'ORDER-123',
        senderAddress: '0x123',
        encryptedPayload: 'ENCRYPTED_DATA',
        timestamp: Date.now(),
      });

      expect(signalRService.totalMessages()).toBe(1);
      expect(signalRService.messages()[0].orderId).toBe('ORDER-123');

      signalRService.setSimulatedStatus(3);
      expect(signalRService.currentOrderStatus()).toBe(3);
    });
  });

  describe('EscrowStateService Signals', () => {
    it('should correctly derive computed escrow states', () => {
      expect(escrowStateService.status()).toBe(EscrowUiStatus.CREATED);
      expect(escrowStateService.isSettled()).toBe(false);
      expect(escrowStateService.isInspectionActive()).toBe(false);

      // Advance to Inspection Window
      escrowStateService.updateStatus(EscrowUiStatus.INSPECTION_WINDOW);
      expect(escrowStateService.isInspectionActive()).toBe(true);
      expect(escrowStateService.canSettleEarly()).toBe(true);
      expect(escrowStateService.isSettled()).toBe(false);

      // Settle
      escrowStateService.updateStatus(EscrowUiStatus.SETTLED);
      expect(escrowStateService.isSettled()).toBe(true);
      expect(escrowStateService.isInspectionActive()).toBe(false);
    });
  });
});
