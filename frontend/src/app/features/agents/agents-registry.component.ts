// SPDX-License-Identifier: MIT
import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SellerAgentService } from '../../core/services/seller-agent.service';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { UsdtPipe } from '../../shared/pipes/usdt.pipe';

export interface AgentProfile {
  id: number;
  name: string;
  role: string;
  address: string;
  reputation: number;
  status: 'ACTIVE' | 'SIMULATED';
  description: string;
  capabilities: string[];
  explorerUrl: string;
  contractStandard: string;
}

@Component({
  selector: 'ayni-agents-registry',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BadgeComponent,
    UsdtPipe,
  ],
  templateUrl: './agents-registry.component.html',
  styleUrl: './agents-registry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsRegistryComponent implements OnInit {
  protected readonly catalogService = inject(CatalogService);
  protected readonly sellerAgentService = inject(SellerAgentService);

  public readonly registryAddress = '0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2';
  public readonly subscriptionManager = '0xBa8FD902f65DeF3153CbD609842CAfe3FD058c78';
  public readonly hskExplorerRegistryUrl =
    'https://testnet-explorer.hskchain.net/address/0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2';

  public readonly agents: AgentProfile[] = [
    {
      id: 1,
      name: 'Ayni Seller Agent',
      role: 'Agente Comercial Autónomo (Ayni Pro)',
      address: '0x6582dCD2587C6094C0Fb3ce986035B1a4157D59a',
      reputation: 101,
      status: 'ACTIVE',
      description:
        'Agente comercial autónomo potenciado por Google Gemini 2.5 Flash Vision. Publica listings a partir de fotos, redacta descripciones, responde preguntas frecuentes técnicas y negocia ofertas en el chat de compraventa dentro de los márgenes del vendedor.',
      capabilities: [
        'Publicación 1-Click con Gemini 2.5 Flash Vision',
        'Extracción automática de marca, modelo y RAM/almacenamiento',
        'Negociación automática en chat (Auto-Aceptar, Contraoferta, Rechazo)',
        'Coordinación de Safe Meet y Video Verify',
        'Identidad y atestación ERC-8004 en HSK Chain',
      ],
      explorerUrl:
        'https://testnet-explorer.hskchain.net/address/0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2',
      contractStandard: 'ERC-8004 Identity & Reputation',
    },
    {
      id: 42,
      name: 'Ayni Hardware Validator Agent',
      role: 'Agente Validador de Integridad Técnica',
      address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      reputation: 100,
      status: 'ACTIVE',
      description:
        'Agente de atestación técnica encargado de auditar hardware de segunda mano. Verifica la prueba Proof of Listing (POL) física, emite compromisos salted keccak256 para números de serie y emite veredictos criptográficos PASS / WARN / FAIL.',
      capabilities: [
        'Auditoría visual de Proof of Listing (POL) efímero',
        'Salted Commitment keccak256(imei, salt, seller)',
        'Verificación de candados de fabricante (iCloud/MDM/Google)',
        'Dictamen formal ERC-8004 ValidationRegistry on-chain',
      ],
      explorerUrl:
        'https://testnet-explorer.hskchain.net/address/0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2',
      contractStandard: 'ERC-8004 ValidationRegistry',
    },
  ];

  public readonly selectedAgent = signal<AgentProfile>(this.agents[0]);
  public readonly selectedAuditJson = signal<string | null>(null);

  public readonly recentAudits = computed(() => {
    return this.catalogService.listings();
  });

  public ngOnInit(): void {
    this.catalogService.fetchListings();
    this.sellerAgentService.getHskInfo();
  }

  public selectAgent(agent: AgentProfile): void {
    this.selectedAgent.set(agent);
  }

  public showAuditDetails(json: string): void {
    this.selectedAuditJson.set(json);
  }

  public closeAuditModal(): void {
    this.selectedAuditJson.set(null);
  }
}
