// SPDX-License-Identifier: MIT
import { Injectable, signal, computed } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import { ChatMessage } from '../models/chat.model';

export interface ChatMessageDto {
  orderId: string;
  senderAddress: string;
  encryptedPayload: string;
  timestamp: number;
}

export interface InspectionStepUpdate {
  orderId: string;
  stepKey: string;
  isPassed: boolean;
  notes: string;
}

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private chatHub: signalR.HubConnection | null = null;
  private escrowHub: signalR.HubConnection | null = null;
  private inspectionHub: signalR.HubConnection | null = null;

  // Vanilla Angular 22 Signals
  public readonly isChatConnected = signal<boolean>(false);
  public readonly isEscrowConnected = signal<boolean>(false);
  public readonly isInspectionConnected = signal<boolean>(false);

  public readonly messages = signal<ChatMessageDto[]>([]);
  public readonly chatMessages = signal<ChatMessage[]>([]);
  public readonly escrowOrders = signal<{ orderId: string; status: number }[]>([]);
  public readonly currentOrderStatus = signal<number | null>(null);
  public readonly lastQrScanResult = signal<boolean | null>(null);
  public readonly inspectionSteps = signal<InspectionStepUpdate[]>([]);

  // Computed state
  public readonly totalMessages = computed(() => this.messages().length);
  public readonly isAllHubsConnected = computed(
    () => this.isChatConnected() && this.isEscrowConnected()
  );

  public async initHubs(baseUrl: string = 'http://localhost:5000'): Promise<void> {
    const token = localStorage.getItem('ayni_jwt_token');
    const options: signalR.IHttpConnectionOptions = {
      accessTokenFactory: () => token || '',
    };

    // 1. ChatHub
    this.chatHub = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/chat`, options)
      .withAutomaticReconnect()
      .build();

    this.chatHub.on(
      'ReceiveMessage',
      (orderId: string, senderAddress: string, encryptedPayload: string, timestamp: number) => {
        const newMsg: ChatMessageDto = { orderId, senderAddress, encryptedPayload, timestamp };
        this.messages.update((msgs) => [...msgs, newMsg]);
      }
    );

    // 2. EscrowHub
    this.escrowHub = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/escrow`, options)
      .withAutomaticReconnect()
      .build();

    this.escrowHub.on('OrderStatusChanged', (orderId: string, status: number) => {
      this.currentOrderStatus.set(status);
    });

    this.escrowHub.on('HandoffQrScanned', (orderId: string, isSuccess: boolean) => {
      this.lastQrScanResult.set(isSuccess);
    });

    // 3. InspectionHub
    this.inspectionHub = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/inspection`, options)
      .withAutomaticReconnect()
      .build();

    this.inspectionHub.on(
      'InspectionStepUpdated',
      (orderId: string, stepKey: string, isPassed: boolean, notes: string) => {
        const update: InspectionStepUpdate = { orderId, stepKey, isPassed, notes };
        this.inspectionSteps.update((steps) => [...steps.filter((s) => s.stepKey !== stepKey), update]);
      }
    );

    // Start connections gracefully
    try {
      await this.chatHub.start();
      this.isChatConnected.set(true);
    } catch {
      // Offline fallback
    }

    try {
      await this.escrowHub.start();
      this.isEscrowConnected.set(true);
    } catch {
      // Offline fallback
    }

    try {
      await this.inspectionHub.start();
      this.isInspectionConnected.set(true);
    } catch {
      // Offline fallback
    }
  }

  public async connectChatHub(): Promise<void> {
    if (!this.chatHub) {
      await this.initHubs();
    }
  }

  public async connectEscrowHub(): Promise<void> {
    if (!this.escrowHub) {
      await this.initHubs();
    }
  }

  public async joinChat(orderId: string): Promise<void> {
    return this.joinOrderChat(orderId);
  }

  public async leaveChat(orderId: string): Promise<void> {
    if (this.chatHub && this.isChatConnected()) {
      try {
        await this.chatHub.invoke('LeaveOrderChat', orderId);
      } catch {
        // Ignore in offline/mock mode
      }
    }
  }

  public async joinEscrowOrder(orderId: string): Promise<void> {
    return this.subscribeToEscrowOrder(orderId);
  }

  public async leaveEscrowOrder(orderId: string): Promise<void> {
    if (this.escrowHub && this.isEscrowConnected()) {
      try {
        await this.escrowHub.invoke('UnsubscribeFromOrder', orderId);
      } catch {
        // Ignore in offline/mock mode
      }
    }
  }

  public async sendMessage(orderId: string, senderAddress: string, messageText: string): Promise<void> {
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      orderId,
      senderAddress,
      messageText,
      sentAtUtc: new Date().toISOString(),
      isAiAgent: false,
    };
    this.chatMessages.update((msgs) => [...msgs, newMsg]);
    return this.sendChatMessage(orderId, senderAddress, messageText);
  }

  public async joinOrderChat(orderId: string): Promise<void> {
    if (this.chatHub && this.isChatConnected()) {
      await this.chatHub.invoke('JoinOrderChat', orderId);
    }
  }

  public async sendChatMessage(orderId: string, senderAddress: string, encryptedPayload: string): Promise<void> {
    if (this.chatHub && this.isChatConnected()) {
      await this.chatHub.invoke('SendMessage', orderId, senderAddress, encryptedPayload);
    } else {
      // Fallback local append
      this.messages.update((msgs) => [
        ...msgs,
        {
          orderId,
          senderAddress,
          encryptedPayload,
          timestamp: Date.now(),
        },
      ]);
    }
  }

  public async subscribeToEscrowOrder(orderId: string): Promise<void> {
    if (this.escrowHub && this.isEscrowConnected()) {
      await this.escrowHub.invoke('SubscribeToOrder', orderId);
    }
  }

  public setSimulatedStatus(status: number): void {
    this.currentOrderStatus.set(status);
  }

  public addSimulatedMessage(msg: ChatMessageDto): void {
    this.messages.update((msgs) => [...msgs, msg]);
  }
}
