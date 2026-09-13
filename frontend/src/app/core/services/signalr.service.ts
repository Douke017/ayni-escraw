import { Injectable, signal, computed } from '@angular/core';
import * as signalR from '@microsoft/signalr';

export interface ChatMessage {
  orderId: string;
  senderAddress: string;
  encryptedPayload: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private chatHub: signalR.HubConnection | null = null;
  private escrowHub: signalR.HubConnection | null = null;

  // Vanilla Angular 22 Signals
  public readonly isChatConnected = signal<boolean>(false);
  public readonly isEscrowConnected = signal<boolean>(false);
  public readonly messages = signal<ChatMessage[]>([]);
  public readonly currentOrderStatus = signal<number | null>(null);

  // Computed state
  public readonly totalMessages = computed(() => this.messages().length);
  public readonly isAllHubsConnected = computed(() => this.isChatConnected() && this.isEscrowConnected());

  public initHubs(baseUrl: string = 'http://localhost:5000'): void {
    this.chatHub = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/chat`)
      .withAutomaticReconnect()
      .build();

    this.chatHub.on('ReceiveMessage', (orderId: string, senderAddress: string, encryptedPayload: string, timestamp: number) => {
      const newMsg: ChatMessage = { orderId, senderAddress, encryptedPayload, timestamp };
      this.messages.update((msgs) => [...msgs, newMsg]);
    });

    this.escrowHub = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/escrow`)
      .withAutomaticReconnect()
      .build();

    this.escrowHub.on('OrderStatusChanged', (orderId: string, status: number, timestamp: number) => {
      this.currentOrderStatus.set(status);
    });
  }

  public setSimulatedStatus(status: number): void {
    this.currentOrderStatus.set(status);
  }

  public addSimulatedMessage(msg: ChatMessage): void {
    this.messages.update((msgs) => [...msgs, msg]);
  }
}
