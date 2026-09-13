# Walkthrough: Ayni Trust Marketplace — Registro de Ejecución por Fases

Este documento es el registro maestro y auditable del avance del proyecto **Ayni Trust Marketplace** sobre **HSK Chain Testnet** (Chain ID 133).

---

## Índice de Fases
- [Fase 0: Scaffolding, Tooling & Entorno Base Multi-Tecnología](#fase-0-scaffolding-tooling--entorno-base-multi-tecnología) — **COMPLETADO & AUDITADO**
- [Fase 1: Smart Contracts Suite en HSK Chain](#fase-1-smart-contracts-suite-en-hsk-chain-foundry--web3-standards) — **COMPLETADO & AUDITADO**

---

## Fase 0: Scaffolding, Tooling & Entorno Base Multi-Tecnología

### 1. Resumen de Componentes Desplegados
- **Docker Compose**: PostgreSQL 16 (`ayni_postgres`), Redis 7 (`ayni_redis`), MinIO S3 (`ayni_minio`) y auto-creación de buckets (`ayni_minio_init`).
- **Foundry**: Solidity 0.8.24, Cancun EVM, OpenZeppelin v5.0.2 y Uniswap Permit2.
- **Backend .NET 9**: Solución Clean Architecture con EF Core, Redis, MinIO y SignalR Hubs (`ChatHub`, `EscrowHub`, `InspectionHub`).
- **AI Agent Service**: Python 3.14 venv con FastAPI, Google Gemini SDK y Web3.py.
- **Frontend Angular 22**: Componentes standalone con Vanilla Signals Services (`web3.service.ts`, `signalr.service.ts`, `escrow-state.service.ts`), Viem y `@microsoft/signalr`.

### 2. Resultados de Checkpoints Fase 0
- **Checkpoint 0.1 (Auditoría de Vulnerabilidades)**:
  - `dotnet list package --vulnerable`: 0 vulnerabilidades.
  - `pip-audit`: 0 vulnerabilidades.
  - `npm audit`: 0 vulnerabilidades.
- **Checkpoint 0.2 (Pruebas Automatizadas Base)**:
  - 17 pruebas ejecutadas con 100% de éxito en contratos, backend, agentes y frontend.

---

## Fase 1: Smart Contracts Suite en HSK Chain (Foundry & Web3 Standards)

### 1. Arquitectura de Smart Contracts Implementada

```
                               ┌─────────────────────────────┐
                               │   Comprador / Vendedor /    │
                               │          Árbitro            │
                               └──────────────┬──────────────┘
                                              │ EIP-712 Signatures / Calls
                                              ▼
                              ┌───────────────────────────────┐
                              │        AyniEscrow.sol         │
                              │ (Permit2, CEI, 2-de-3 Multisig│
                              │   Pausable, Ownable2Step)     │
                              └───┬───────────────────────┬───┘
               Liquidación Atómica│                       │ Record Feedback
               (Transfiere NFT)   ▼                       ▼
            ┌───────────────────────────┐   ┌───────────────────────────┐
            │  AyniProductPassport.sol  │   │   AyniAgentRegistry.sol   │
            │  (ERC-721, Salted Commit) │   │   (ERC-8004 Multi-Reg)    │
            └───────────────────────────┘   └───────────────────────────┘
                                                          ▲
                                                          │ Atribución On-Chain
                                            ┌─────────────┴─────────────┐
                                            │      AI Agent Service     │
                                            │     (Python / FastAPI)    │
                                            └───────────────────────────┘
```

### 2. Contratos Desarrollados

#### 2.1 [AyniProductPassport.sol](file:///home/douke017/Personal/Ayni-Scrow/contracts/src/AyniProductPassport.sol)
- **Estándar**: ERC-721 con herencia de `Ownable2Step`.
- **Privacidad Hardware (Zero Plaintext Leaks)**:
  $$\text{productCommitment} = \text{keccak256}(\text{abi.encodePacked}(\text{imei}, \text{salt}, \text{seller}))$$
  El contrato no expone ni almacena números de serie ni códigos IMEI en texto plano.
- **Restricción de Transferencia**: `transferFromEscrow()` solo puede ser invocado por `escrowContract`.
- **Control Antirrobo / Bloqueo**: `flagPassport(tokenId, isFlagged)` permite inmovilizar tokens ante reportes de bloqueo o hardware no genuino.

#### 2.2 [AyniAgentRegistry.sol](file:///home/douke017/Personal/Ayni-Scrow/contracts/src/AyniAgentRegistry.sol)
- **Estándar ERC-8004 Multi-Registry**:
  1. *Identity Registry*: `registerAgent(address, string agentURI)` inicializa reputación en 100 y asocia el URI descentralizado de capacidades.
  2. *Validation Registry*: `recordValidation(listingId, agentId, dictum, proofHash)` atestigua dictámenes `PASS (0)`, `WARN (1)` y `FAIL (2)`.
  3. *Reputation Registry*: `recordFeedback(agentId, orderId, delta)` muta el puntaje (+1 por liquidación exitosa, -1 por disputa en arbitraje), restringido exclusivamente a llamadas autenticadas de `AyniEscrow`.
- **Seguridad**: `Ownable2Step` y `Pausable` para congelación preventiva ante emergencias.

#### 2.3 [AyniEscrow.sol](file:///home/douke017/Personal/Ayni-Scrow/contracts/src/AyniEscrow.sol)
- **Depósitos Seguros Permit2**:
  - `depositWithPermit2(...)` utiliza `permitWitnessTransferFrom` con testigo estructurado EIP-712:
    `AyniEscrowWitness(bytes32 orderId,address buyer,address seller)`.
  - Validación obligatoria de caducidad: `if (block.timestamp > permit.deadline) revert PermitDeadlineExpired();`.
- **Patrón Checks-Effects-Interactions (CEI)**:
  - Todas las mutaciones de estado (`order.status = ...`) y emisiones de eventos preceden de forma estricta las transferencias de tokens ERC-20 y llamadas externas.
- **Modificador de Reentrancia**: `nonReentrant` colocado como primer modificador en todas las funciones externas mutables.
- **Ventana de Inspección Condicional (24 Horas)**:
  - `confirmHandoff(...)` inicia la cuenta regresiva (`inspectionDeadline = block.timestamp + 24 hours`).
  - El comprador puede liquidar anticipadamente en cualquier momento si está satisfecho (`settleOrder`).
  - El vendedor solo puede forzar la liquidación si han transcurrido más de 24 horas sin disputas (`InspectionWindowActive` previene liquidaciones prematuras).
- **Arbitraje Multifirma 2-de-3 (`resolveDispute2of3`)**:
  - Requiere dos firmas criptográficas distintas recuperadas con `ECDSA.recover(toEthSignedMessageHash(...))`.
  - Conjunto de firmantes permitidos: `{Comprador, Vendedor, Árbitro}`.
  - El árbitro no puede desviar fondos unilateralmente:
    - (Árbitro + Comprador) $\rightarrow$ Reembolso total al comprador.
    - (Árbitro + Vendedor) $\rightarrow$ Liberación de fondos al vendedor.
  - Rechazo de firmas duplicadas (`DuplicateSigners`) o de terceros no autorizados (`InvalidMultisigSigner`).

#### 2.4 Script de Despliegue Reproducible ([DeployAyniSuite.s.sol](file:///home/douke017/Personal/Ayni-Scrow/contracts/script/DeployAyniSuite.s.sol))
- Despliega de forma determinista la suite completa, interconecta autorizaciones (`setEscrowContract`) y registra al agente inicial de Gemini AI.

---

### 3. Resultados de los Checkpoints Fase 1

#### Checkpoint 1.1: Auditoría de Seguridad Web3 (`solidity-audit` & `solidity-security`)

| Control de Seguridad | Verificación Realizada | Estado |
|---|---|---|
| **Checks-Effects-Interactions (CEI)** | Todas las mutaciones de estado interno (`order.status = ...`) y logs preceden llamadas a tokens o contratos externos | **APROBADO** |
| **Reentrancy Protection** | Modificador `nonReentrant` de OpenZeppelin v5 implementado como primer modificador en todos los métodos con flujo de fondos | **APROBADO** |
| **Control de Acceso & Propiedad** | Herencia de `Ownable2Step` en todos los contratos; transferencias de NFT y feedback restringidos a `escrowContract` | **APROBADO** |
| **Análisis Estático Slither** | Slither v0.11.6 ejecutado contra los 31 contratos y 102 detectores: **0 vulnerabilidades de severidad Alta o Media** | **APROBADO** |
| **Protección de Privacidad Hardware** | Ningún IMEI o número de serie viaja en texto plano; verificación basada en compromisos salteados | **APROBADO** |
| **Optimización de Gas** | Errores personalizados (`revert InvalidAddress();`) en lugar de `require` con strings | **APROBADO** |

#### Checkpoint 1.2: Batería de Pruebas Unitarias, Fuzzing e Invariantes

```
Ran 5 test suites: 25 tests passed, 0 failed, 0 skipped (25 total tests)

1. BaseSetupTest:
   ✔ test_BaseSuiteDeployment
   ✔ test_FullHappyPathEscrowSettlement
   ✔ test_HardwareCommitmentVerification

2. AyniAgentRegistryTest:
   ✔ test_RegisterAgent_Success
   ✔ test_RegisterAgent_RevertsOnDuplicate
   ✔ test_ValidationRegistry_RecordAndQuery
   ✔ test_ValidationRegistry_RevertsUnauthorizedAgent
   ✔ test_ReputationRegistry_EscrowFeedback
   ✔ test_PausableEmergency

3. AyniProductPassportTest:
   ✔ test_DeploymentMetadata
   ✔ test_Ownable2Step_Transfer
   ✔ test_MintPassport_Success
   ✔ test_MintPassport_RevertsOnInvalidCondition
   ✔ test_TransferFromEscrow_Success
   ✔ test_FlagStolen_PreventsEscrowTransfer
   ✔ test_HardwareCommitmentVerification_Precision
   ✔ testFuzz_HardwareCommitment (256 runs)

4. AyniEscrowTest:
   ✔ test_CreateOrder_Validations
   ✔ test_EarlySettlement_ByBuyer
   ✔ test_TimelockedSettlement_BySeller
   ✔ test_DisputeResolution2of3_RefundToBuyer
   ✔ test_DisputeResolution2of3_ReleaseToSeller
   ✔ test_DisputeResolution2of3_RevertsOnDuplicateOrUnauthorizedSigners
   ✔ testFuzz_EscrowAmountSettlement (256 runs)

5. AyniEscrowInvariantsTest:
   ✔ invariant_SolvencyMatchesActiveOrders (256 runs, 128,000 llamadas aleatorias)
```

**Demostración del Invariante de Solvencia**:
A lo largo de 128,000 llamadas pseudoaleatorias intercalando `createAndFundOrder` y `settleRandomOrder`, el saldo de USDT custodiado por `AyniEscrow` fue en todo momento matemáticamente idéntico a la suma de órdenes activas no resueltas.

---

## 4. Próximos Pasos (Fase 2)

Habiendo superado con 100% de éxito los Checkpoints 1.1 y 1.2:
- **Fase 2: Servicio de Agentes de IA en Python & Gemini API (ERC-8004 On-Chain)**
  - Implementación del pipeline de visión multimodal y texto con Google Gemini 2.5 Flash.
  - Firma y despacho de transacciones on-chain con Web3.py hacia `AyniAgentRegistry.sol` en HSK Testnet.
  - Matriz de validación y generación de pruebas criptográficas SHA-256 de checklist físico.
