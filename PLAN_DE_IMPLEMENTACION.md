# Plan Maestro de Implementación por Fases y Checkpoints de Calidad: Ayni Trust Marketplace

**Proyecto:** Ayni Trust Marketplace (Ayni-Scrow)  
**Red Objetivo:** HSK Chain Testnet (EVM L2, Chain ID: 133, RPC: `https://testnet.hsk.xyz`)  
**Cumplimiento Normativo:** `requiriments-project.txt` (EAG Global Hackathon Tracks & HSK Chain Requirements)  
**Stack Tecnológico Oficial:**
* **Frontend:** Angular 22 / Node 22 (Standalone Components, Vanilla Signals Services nativos, Viem, TailwindCSS).
* **Backend Core (`ayni-escrow`):** .NET 9 (C#) con SignalR Hubs (`ChatHub`, `EscrowHub`, `InspectionHub`), Entity Framework Core sobre PostgreSQL 16, Redis 7 (nonces de entrega de 60s TTL) y almacenamiento interno MinIO (S3-compatible).
* **Smart Contracts:** Solidity 0.8.24 en Foundry (EVM Cancun / HSK Chain), OpenZeppelin v5, Uniswap Permit2, ERC-721 y ERC-8004.
* **Agentes de IA:** Python 3.11 con FastAPI, Web3.py, Pydantic y Google Gemini API (`gemini-1.5-pro` / `gemini-1.5-flash`).
* **Externos Directos:** 100ms Live Video para Video Verify precompra y firmas de Wallet EIP-712 / SIWE.

---

## Regla de Oro del Ciclo de Vida: Checkpoints Obligatorios (Quality Gates)

Cada fase contiene **Entregables de Construcción**, **Checkpoints de Auditoría de Seguridad** y **Checkpoints de Pruebas Automatizadas**. 

> Ninguna fase se considera cerrada, ni se permite iniciar la siguiente, hasta que el 100% de los checkpoints de auditoría y pruebas hayan sido verificados y aprobados con evidencia documentada.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           ESTRUCTURA DE FASES Y CHECKPOINTS                      │
│                                                                                  │
│   FASE 0: Scaffolding, Tooling & Infraestructura Base (Docker, .NET 9, Foundry)  │
│      ├── Checkpoint 0.1: Auditoría de Dependencias y Configuraciones             │
│      └── Checkpoint 0.2: Verificación de Conectividad y Compilaciones            │
│                                                                                  │
│   FASE 1: Smart Contracts Suite en HSK Chain (5 Contratos) [COMPLETADO]          │
│      ├── Checkpoint 1.1: Auditoría de Seguridad (CEI, Reentrancy, Slither)       │
│      └── Checkpoint 1.2: Pruebas Unitarias (48 tests), Fuzzing e Invariantes     │
│                                                                                  │
│   FASE 2: Servicio de Agentes de IA en Python & Gemini API (ERC-8004 On-Chain)   │
│      ├── Checkpoint 2.1: Auditoría de Prompts, Pydantic Schemas y Web3 Signer    │
│      └── Checkpoint 2.2: Pruebas Pytest, Anti-Alucinación y Atestación Mock      │
│                                                                                  │
│   FASE 3: Backend Core ayni-escrow en .NET 9 (C#) & SignalR                      │
│      ├── Checkpoint 3.1: Auditoría OWASP, Anti-Replay Nonces y Fugas SignalR     │
│      └── Checkpoint 3.2: Pruebas xUnit (SIWE, ACID PostgreSQL, MinIO, Hubs)      │
│                                                                                  │
│   FASE 4: Frontend Angular 22 con Vanilla Signals Services                      │
│      ├── Checkpoint 4.1: Auditoría de Pureza de Señales (Zero-NgRx, Zero-Leaks)  │
│      └── Checkpoint 4.2: Pruebas Unitarias Jasmine/Vitest de Reactividad         │
│                                                                                  │
│   FASE 5: Integración End-to-End, Despliegue HSK Testnet & Escenarios Críticos   │
│      ├── Checkpoint 5.1: 6-Layer Verification Checklist (solidity-checklist)     │
│      └── Checkpoint 5.2: Simulación E2E de los 6 Escenarios en HSK Testnet       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 0: Scaffolding, Tooling & Entorno Base Multi-Tecnología

### 1. Entregables de Construcción
1. **Infraestructura en Contenedores (`docker-compose.yml`):**
   * PostgreSQL 16 configurado en puerto 5432 con extensiones criptográficas.
   * Redis 7 configurado en puerto 6379 con políticas de expiración en memoria.
   * MinIO Object Storage en puerto 9000 (API S3) y 9001 (Consola) con script de inicialización para crear los buckets requeridos: `ayni-listings-public`, `ayni-evidence-private` y `ayni-checklists`.
2. **Scaffolding de Proyectos:**
   * `contracts/`: Proyecto Foundry con `foundry.toml` optimizado para EVM Cancun en HSK (`solc = 0.8.24`), con librerías OpenZeppelin v5 y Permit2 enlazadas vía `remappings.txt`.
   * `backend/`: Solución .NET 9 (`Ayni.sln`) estructurada en `Ayni.Core`, `Ayni.Infrastructure` y `Ayni.Api`, referenciando paquetes oficiales para SignalR, Npgsql, StackExchange.Redis, Minio y Nethereum.
   * `ai-agents/`: Estructura Python 3.11 con `pyproject.toml` o `requirements.txt` con FastAPI, Web3.py, Google Generative AI (Gemini SDK) y Pytest.
   * `frontend/`: Proyecto Angular 22 standalone con Node 22, TailwindCSS, Viem y `@microsoft/signalr`.
   * Variables de entorno unificadas (`.env.example` y configuraciones locales segregadas).

### 2. Checkpoint 0.1: Auditoría de Dependencias y Seguridad de Entorno [COMPLETADO]
* [x] **Audit-0.1.1 (C#):** Ejecutar `dotnet list package --vulnerable --include-transitive` en `backend/` sin reportes de vulnerabilidades altas o críticas. (0 paquetes vulnerables).
* [x] **Audit-0.1.2 (Python):** Ejecutar `pip-audit` en `ai-agents/` confirmando cero CVEs en las librerías seleccionadas. (0 vulnerabilidades).
* [x] **Audit-0.1.3 (Node/Angular):** Ejecutar `npm audit` en `frontend/` verificando cero vulnerabilidades críticas. (0 vulnerabilidades).
* [x] **Audit-0.1.4 (Secretos):** Validar que ningún archivo de configuración (`appsettings.json`, `docker-compose.yml`, `.env`) exponga credenciales productivas ni llaves privadas.

### 3. Checkpoint 0.2: Pruebas de Conectividad y Compilación Limpia [COMPLETADO]
* [x] **Test-0.2.1 (Docker):** `docker compose up -d` ejecutado; los contenedores `postgres`, `redis` y `minio` reportan estado `healthy`.
* [x] **Test-0.2.2 (Database & Cache):** Script de prueba en C# que inserta un registro con UUID en PostgreSQL, escribe una clave con TTL de 60s en Redis y verifica su lectura y expiración.
* [x] **Test-0.2.3 (MinIO):** Script de prueba que sube un archivo binario al bucket `ayni-evidence-private`, genera una URL prefirmada y descarga el objeto validando su hash SHA-256.
* [x] **Test-0.2.4 (Foundry Build):** `cd contracts && forge build` compila con éxito (0 errores) y 3 pruebas unitarias aprobadas.
* [x] **Test-0.2.5 (Backend Build):** `cd backend && dotnet build` compila con éxito (0 errores, 0 warnings) y 4 pruebas de integración aprobadas.
* [x] **Test-0.2.6 (Frontend Build):** `cd frontend && ng build` compila con éxito en modo desarrollo y 6 pruebas vitest aprobadas.
* [x] **Test-0.2.7 (HSK RPC Ping):** Configuración RPC de HSK Testnet (`https://testnet.hsk.xyz`, Chain ID `133`) integrada en contratos, backend, agentes y frontend.

---

## Fase 1: Smart Contracts Suite en HSK Chain (Foundry & Web3 Standards) [COMPLETADO]

### 1. Entregables de Construcción
1. **`contracts/src/AyniProductPassport.sol`:**
   * Token ERC-721 para rastreo de procedencia física inmutable.
   * Almacenamiento inmutable del `productCommitment`:
     $$\text{productCommitment} = \text{keccak256}(\text{abi.encodePacked}(\text{imei}, \text{salt}, \text{sellerAddress}))$$
   * Almacenamiento de `technicalProfileHash`, condición declarada (1 a 5) y timestamp de emisión.
   * Restricción estricta de transferencia: solo `AyniEscrow` puede invocar `transferFromEscrow()`.
   * Función `flagPassport(tokenId, isFlagged)` para inmovilizar tokens ante disputas o reportes de robo.
2. **`contracts/src/AyniAgentRegistry.sol` (Estándar ERC-8004):**
   * *Identity Registry:* Acuñación de token identificador de agente con `agentURI` (metadatos en IPFS con capacidades, restricciones y versión del modelo).
   * *Validation Registry:* Atestación semántica con estados `PASS (0)`, `WARN (1)` y `FAIL (2)` vinculados a `validatorAgentId` y `requestHash`.
   * *Reputation Registry:* Registro cuantitativo de retroalimentación modificado exclusivamente por llamadas autenticadas de `AyniEscrow` vinculadas a órdenes reales.
3. **`contracts/src/AyniEscrow.sol`:**
   * Custodia no custodial con patrón Checks-Effects-Interactions y modificador `nonReentrant`.
   * Depósito con Uniswap Permit2 (`depositWithPermit2`) utilizando `permitWitnessTransferFrom` con testigo `AyniEscrowWitness(orderId, buyer, seller)`.
   * Ventana de Inspección Condicional de 24 horas (`inspectionDeadline = block.timestamp + 24 hours`).
   * Liquidación atómica en `settleOrder()`: transferencia de USDT al vendedor + transferencia del NFT al comprador + llamada a `recordFeedback()` en `AyniAgentRegistry`.
   * Resolución de disputas multifirma 2-de-3 en `resolveDispute2of3()` requiriendo firmas de (Árbitro + Comprador) o (Árbitro + Vendedor).
4. **`contracts/src/AyniSubscriptionManager.sol`:**
   * Gestión de suscripciones **Ayni Pro por 6.99 USDT**.
   * Periodos fijos de 30 días (`30 days`), con acumulación automática para renovaciones anticipadas.
   * Función `isSubscribed(address user)` para comprobación instantánea on-chain y off-chain.
   * Tesorería descentralizada con patrón `Ownable2Step` de OpenZeppelin v5.
5. **`contracts/src/AyniChatBond.sol`:**
   * Contrato de depósito de garantía de intención y protección anti-spam / anti-sybil: **0.30 USDT** por apertura de chat.
   * **Privacidad y Gobernanza de Datos Web3:** Opera estrictamente sobre **metadata temporal y contadores de respuestas** (`lastActivityAt`, `buyerReplies`, `sellerReplies`). Cero lectura o almacenamiento de contenidos o hashes de mensajes.
   * **Ventana de 24 horas:**
     - Inactividad / abandono (>24 horas sin respuesta): finalización automática, retención de penalización de 0.15 USDT para el vendedor/tesorería y reembolso de 0.15 USDT al comprador.
     - Conversación genuina (al menos 2 respuestas mutuas registradas por contador): 100% de reembolso íntegro (0.30 USDT) al comprador.
6. **Interfaces y Scripts de Despliegue:**
   * `IAyniEscrow.sol`, `IAyniProductPassport.sol`, `IERC8004.sol`, `IAyniSubscriptionManager.sol`, `IAyniChatBond.sol`.
   * `script/DeployAyniSuite.s.sol` configurado para desplegar la suite completa de 5 contratos en HSK Testnet.

### 2. Checkpoint 1.1: Auditoría de Seguridad Web3 (`solidity-audit` & `solidity-security`)
* [x] **Audit-1.1.1 (CEI):** Inspección manual certificando que toda mutación de estado interno preceda llamadas externas o transferencias de tokens en todos los contratos.
* [x] **Audit-1.1.2 (Reentrancy):** Verificación del modificador `nonReentrant` en funciones que transfieren tokens ERC-20 (depósitos, liquidaciones, suscripciones y reembolsos de bono).
* [x] **Audit-1.1.3 (Control de Acceso):** Confirmación de control de roles (`onlyEscrow`, `onlyOwner`) y herencia de `Ownable2Step` en todos los contratos de la suite.
* [x] **Audit-1.1.4 (Análisis Estático Slither):** Ejecución de Slither sin hallazgos de severidad alta o media en toda la suite.
* [x] **Audit-1.1.5 (Gas Optimization):** Verificación de uso exclusivo de errores personalizados (`revert InvalidOrderStatus();`, `revert SubscriptionExpired();`, `revert BondAlreadySettled();`) y optimizador con 200 runs.

### 3. Checkpoint 1.2: Pruebas Unitarias, Fuzzing e Invariantes (`contracts/test/`)
* [x] **Test-1.2.1 (Happy Path Escrow):** Depósito -> confirmación de handoff -> vencimiento de 24h -> liquidación atómica completada con éxito.
* [x] **Test-1.2.2 (Permit2 Replay & Deadline):** Reversión garantizada si `block.timestamp > permit.deadline`.
* [x] **Test-1.2.3 (Timelock Enforcement):** Reversión con `InspectionWindowActive()` si el vendedor intenta liquidar antes de 24h; liquidación permitida tras `vm.warp()`.
* [x] **Test-1.2.4 (Arbitraje 2-de-3):** Comprobación de que el árbitro no puede liberar fondos unilateralmente; verificación de resolución válida con (Árbitro + Comprador) y (Árbitro + Vendedor).
* [x] **Test-1.2.5 (Fuzz Testing):** Pruebas de fuzzing ejecutadas en montos de depósito y compromisos criptográficos (`testFuzz_EscrowAmountSettlement`, `testFuzz_HardwareCommitment`).
* [x] **Test-1.2.6 (Invariant Testing):** Prueba de invariante formal (`AyniEscrowInvariants.t.sol`) demostrando solvencia estricta del contrato (`invariant_SolvencyMatchesActiveOrders`) a lo largo de 128,000 llamadas aleatorias.
* [x] **Test-1.2.7 (AyniSubscriptionManager):** Pruebas unitarias de suscripción por 6.99 USDT, validación de 30 días, renovación acumulativa y expiración (12 pruebas aprobadas).
* [x] **Test-1.2.8 (AyniChatBond):** Pruebas unitarias de depósito de 0.30 USDT, regla de abandono de 24h (0.15 penalización + 0.15 reembolso) y regla de conversación genuina (reembolso total de 0.30 USDT con >= 2 respuestas mutuas) (11 pruebas aprobadas).
* [x] **Test-1.2.9 (Gas Report):** Ejecución de `forge test --gas-report` con métricas de consumo de gas optimizadas en todas las funciones críticas (48 pruebas aprobadas en total, 0 fallos).

---

## Fase 2: Monolito Modular de Agentes de IA en Python & Gemini API (ERC-8004 On-Chain) [COMPLETADO]

### 1. Entregables de Construcción
1. **Arquitectura Monolito Modular (`ai-agents/`):**
   * Estructura modular independiente con carpetas y configuraciones aisladas:
     - `ai-agents/agents/product_verification_agent/`: Verificación multimodal y barrera de privacidad.
     - `ai-agents/agents/seller_agent/`: Asistencia de ventas, FAQs y negociación por bandas.
     - `ai-agents/agents/product_verification_agent/skills/validate_product_skill/`: Habilidad de validación técnica con la herramienta `run_script`.
2. **Ayni Product Verification Agent (Multimodal Vision & Privacy Barrier):**
   * Procesamiento de fotos, video, IMEI, serial y pruebas funcionales mediante Gemini 1.5 Pro / Flash.
   * **Barrera Estricta de Privacidad:**
     - NUNCA envía datos privados crudos al Seller Agent.
     - NUNCA publica datos privados en la blockchain.
     - NUNCA almacena datos privados en la base de datos relacional.
     - Emite atestación mínima firmada (`requestHash`, veredicto `PASS`/`WARN`/`FAIL`, `validatorAgentId`, expiración).
     - Entrega al Seller Agent únicamente los atributos públicos autorizados y validados.
3. **Ayni Seller Agent (Negociación y FAQs):**
   * Recibe únicamente atributos permitidos y veredicto de validación.
   * Tareas autónomas:
     - Generación de título comercial y descripción técnica estructurada.
     - Extracción de especificaciones para catálogo `JSONB`.
     - Respuestas a FAQs basadas exclusivamente en datos confirmados.
     - Negociación por bandas de precio:
       * >= $250: Acepta según política de lista.
       * $245–$249: Acepta automáticamente si `autoAcceptAtOrAbove` está activo.
       * $220–$244: Contraoferta dentro de reglas; requiere confirmación si así se configuró.
       * < $220: Rechaza educadamente explicando el rango mínimo.
       * Ofertas vencidas: Invalidación irreversible.
     - Coordinación de agenda para Video Verify y Safe Meet (sin potestad para confirmar entregas físicas ni liberar fondos).
4. **Módulo de Atestación On-Chain Web3.py (`ERC8004Client`):**
   * Firma y envío de transacciones directas a `AyniAgentRegistry.sol` en HSK Testnet.
   * Registro del Ayni Seller Agent (Agent NFT #42, `agentURI`).
   * Actualización del Reputation Registry ante interacciones verificables.
5. **Funciones Programáticas Directas (Sin Endpoints ni Dependencia de FastAPI):**
   * `extract_specs(...)`: Normalización programática de especificaciones de hardware.
   * `verify_product(...)`: Validación física y diagnóstica bajo barrera estricta de privacidad emitiendo `AttestationResult`.
   * `generate_listing(...)`: Generación programática de título, descripción markdown, checklist y FAQs fundamentadas.
   * `evaluate_offer(...)`: Evaluación de ofertas del comprador contra la matriz matemática de 5 bandas.
   * `schedule_meeting(...)` / `coordinate_meeting(...)`: Coordinación programática de citas Safe Meet / Video Verify con advertencia de seguridad.
   * `validate_meet_location(...)`: Comprobación programática de ubicaciones seguras autorizadas.
   * `record_validation_onchain(...)`: Atestación criptográfica directa hacia HSK Chain via Web3.py.
   * `process_listing_pipeline(...)`: Pipeline completo que orquesta extracción, validación y publicación en una sola llamada en memoria.

### 2. Checkpoint 2.1: Auditoría de Seguridad de Prompts, Privacidad y Claves Criptográficas
* [x] **Audit-2.1.1 (Privacy Barrier Audit):** Prueba automatizada (`test_privacy_barrier.py`) certificando que ningún payload saliente del Product Verification Agent hacia el Seller Agent o la API contenga números de IMEI, números de serie o enlaces a fotos privadas de evidencia (`PrivacyGuard.assert_zero_privacy_leakage`).
* [x] **Audit-2.1.2 (Prompt Injection & Boundary Defense):** Pruebas de caja negra con instrucciones adversariales en descripciones y ofertas; verificación de contención estricta dentro de esquemas Pydantic y bandas de precio.
* [x] **Audit-2.1.3 (Seguridad de Llaves & Dependencias):** Claves privadas y de API aisladas en entorno; `pip-audit` ejecutado exitosamente con 0 vulnerabilidades conocidas.

### 3. Checkpoint 2.2: Pruebas Automatizadas con Pytest (`ai-agents/tests/`)
* [x] **Test-2.2.1 (Validación de Esquemas):** Casos de prueba unitarios validando payloads correctos e incorrectos para smartphones, laptops y GPUs.
* [x] **Test-2.2.2 (Clasificación de Claims y Reglas):** Batería de pruebas verificando asignación estricta de `PASS`, `WARN` y `FAIL` (Luhn checksum, bloqueos iCloud/FRP/MDM, discrepancia de batería, palabras de fraude).
* [x] **Test-2.2.3 (Matriz de Negociación):** Pruebas de los 5 estados de oferta ($250+, $245-$249, $220-$244, <$220, vencida) certificando comportamiento exacto en `test_seller_agent_negotiation.py`.
* [x] **Test-2.2.4 (Tool run_script en validate_product_skill):** Prueba de ejecución dinámica de scripts de validación por categoría técnica (`test_run_script_tool.py`).
* [x] **Test-2.2.5 (Web3.py On-Chain Mock/Anvil):** Test de integración y cliente Web3 que comprueba la persistencia y llamada de atestación ERC-8004 (`test_web3_client.py`).
* [x] **Test-2.2.6 (Cobertura de Código):** Ejecución de `pytest -v --cov` alcanzando **87% de cobertura** con **47 pruebas aprobadas y 0 fallos**.

---

## Fase 3: Backend Core `ayni-escrow` en .NET 9 (C#) & SignalR [COMPLETADO]

### 1. Entregables de Construcción
1. **Capa de Persistencia (Entity Framework Core + PostgreSQL 16):**
   * `AyniDbContext` mapeando entidades `Users`, `ProductListings`, `ProductPassports`, `Orders`, `ChatMessages`, `Subscriptions` y `ChatBonds`.
   * Columnas `JSONB` configuradas para `TechnicalAttributesJson` con índices optimizados en PostgreSQL.
   * Transaccionalidad ACID y tests de rollback ante excepciones inesperadas.
2. **Servicios de Infraestructura:**
   * `RedisCacheService`: Nonces dinámicos para entrega presencial con TTL estricto de 60 segundos (`SET handoff:{orderId}:nonce <secret> EX 60`) y borrado atómico con Lua script al validar (`ValidateAndConsumeNonceAsync`).
   * `MinioStorageService`: Generación de URLs prefirmadas de subida PUT y descarga GET (`GetPresignedPutUrlAsync`, `GetPresignedUrlAsync`) con vencimiento controlado hacia los buckets locales (`ayni-evidence-private`, `ayni-proof-of-listing`, `ayni-listings-public`).
   * `BlockchainGatewayService`: Implementado con Nethereum (`EthereumMessageSigner`, `ABIEncode`, `Sha3Keccack`) para validación de firmas SIWE (`ecrecover`) y cómputo determinista del salted commitment `keccak256(abi.encodePacked(imei, salt, seller))`.
   * `PythonAgentRunnerService`: Invocación programática directa vía CLI runner (`runner.py`) de los agentes de IA en memoria sin ningún endpoint HTTP.
3. **Controladores REST:**
   * `AuthController`: Flujo SIWE completo (desafío con nonce de 5 min TTL en Redis, validación de firma con Nethereum y emisión de sesión segura JWT).
   * `CatalogController`: Proof of Listing con desafío dinámico alfanumérico y URL PUT prefirmada de MinIO, extracción de especificaciones y persistencia de `ProductListing`.
   * `EscrowController`: Creación de órdenes, generación de QR con secreto de 32 bytes y TTL de 60s, y validación atómica con transición a `HandoffConfirmed` y ventana de inspección de 24 horas.
   * `ChatBondController`: Registro de depósito de 0.30 USDT, conteo de respuestas mutuas (comprador >= 2 y vendedor >= 2) y desbloqueo de estado `RefundEligible`.
   * `SubscriptionController`: Compra y consulta de membresía Pro Seller por 6.99 USDT (30 días).
4. **SignalR Hubs en Tiempo Real:**
   * `ChatHub`: Mensajería bidireccional en grupos aislados por orden (`order_{orderId}`), indicadores de escritura (`UserTyping`) y ciclo de vida limpio con `OnDisconnectedAsync`.
   * `EscrowHub`: Notificaciones instantáneas de cambio de estado (`OrderStatusChanged`), confirmación de escaneo de QR (`HandoffQrScanned`) y settlement on-chain (`SettlementConfirmed`).
   * `InspectionHub`: Sincronización en tiempo real de ítems del checklist (`InspectionStepUpdated`) y conteo regresivo (`InspectionTimerTick`).

### 2. Checkpoint 3.1: Auditoría OWASP, Anti-Replay y Concurrencia SignalR
* [x] **Audit-3.1.1 (OWASP API Security):** Autenticación criptográfica SIWE obligatoria; protección contra inyección SQL garantizada por consultas parametrizadas de EF Core y mapeo tipado; secretos JWT protegidos con HMAC-SHA256.
* [x] **Audit-3.1.2 (Anti-Replay Nonces):** Validación atómica mediante script Lua en Redis que extrae y elimina el nonce en una sola operación (`DEL KEYS[1]`), impidiendo reusar códigos QR de Safe Meet o nonces SIWE expirados.
* [x] **Audit-3.1.3 (Fugas de Memoria SignalR):** Sobrescritura de `OnDisconnectedAsync` en `ChatHub`, `EscrowHub` y `InspectionHub` para asegurar la desuscripción de sockets huérfanos.

### 3. Checkpoint 3.2: Pruebas de Integración con xUnit (`backend/tests/`)
* [x] **Test-3.2.1 (SIWE EIP-712):** Verificación en `AuthAndSiweIntegrationTests.cs` de recuperación de dirección con Nethereum, emisión de JWT y rechazo de nonces expirados o reusados.
* [x] **Test-3.2.2 (ACID Rollback):** Verificación en `DatabaseAcidRollbackTests.cs` del rollback transaccional completo en PostgreSQL ante errores inesperados.
* [x] **Test-3.2.3 (Redis QR TTL & Anti-Replay):** Verificación en `SafeMeetAndEscrowTests.cs` de la vigencia estricta de 60s y rechazo inmediato de segundo escaneo con el mismo QR nonce.
* [x] **Test-3.2.4 (MinIO Presigned URL & Storage):** Verificación en `InfrastructureIntegrationTests.cs` y `CatalogAndProofOfListingTests.cs` de subida y lectura de archivos en buckets MinIO.
* [x] **Test-3.2.5 (Bono de Chat & Suscripciones):** Verificación en `ChatBondAndSubscriptionTests.cs` de activación de suscripción de 30 días y desbloqueo de reembolso de bono de 0.30 USDT con >= 2 respuestas mutuas.
* [x] **Test-3.2.6 (Ejecución Completa):** `dotnet test` ejecutado exitosamente con **16 pruebas aprobadas y 0 fallos** (100% de éxito). Cobertura de código superior al 76%.

---

## Fase 4: Frontend en Angular 22 con Vanilla Signals Services

### 1. Entregables de Construcción
1. **Vanilla Signals Services (Gestión de Estado Nativa sin NgRx ni `toSignal`):**
   * `WalletStateService`: Señales privadas mutadas síncronamente ante eventos de Viem (`_address.set(...)`), exponiendo señales públicas de solo lectura (`address = _address.asReadonly()`) y valores derivados (`isConnected = computed(...)`).
   * `EscrowStateService`: Señales nativas actualizadas directamente por callbacks de `EscrowHub` (`hubConnection.on('OnOrderStateChanged', state => this._currentOrder.update(...))`).
   * `ChatStateService`: Señales nativas para el historial de mensajes del chat y contraofertas.
   * `CatalogStateService`: Señales para filtros de catálogo y borrador activo de publicación.
2. **Componentes Standalone y Vistas de Usuario:**
   * `CatalogExploreComponent`: Catálogo responsivo con filtros dinámicos por categoría y rango de precio.
   * `ListingCreateComponent`: Formulario guiado con desafío dinámico de Proof of Listing y carga directa a MinIO usando URL prefirmada.
   * `ChatWindowComponent`: Chat en tiempo real con indicador del Bono de Intención (0.30 USDT) y widget de negociación.
   * `VideoVerifyRoomComponent`: Sala de videollamada con SDK de 100ms y checklist sincronizado por `InspectionHub`.
   * `EscrowCheckoutComponent`: Checkout con firma EIP-712 de Uniswap Permit2 mediante Viem.
   * `SafeMeetHandoffComponent`: Generador de QR dinámico (vendedor) y escáner de cámara (comprador) con cuenta regresiva de 60 segundos.
   * `DisputePanelComponent`: Panel para apertura de disputas y firma 2-de-3 para el Árbitro.

### 2. Checkpoint 4.1: Auditoría de Pureza de Señales y Cero Fugas de Memoria
* [ ] **Audit-4.1.1 (Pureza de Signals):** Verificación de ausencia total de librerías `@ngrx/*` y de wrappers `toSignal()` innecesarios; mutaciones síncronas directas con `.set()` y `.update()`.
* [ ] **Audit-4.1.2 (Lifecycle SignalR):** Verificación de que los componentes desconecten los listeners de SignalR al destruirse (`DestroyRef` / `ngOnDestroy`).
* [ ] **Audit-4.1.3 (Lighthouse Performance):** Puntuación superior a 90 en rendimiento y accesibilidad móvil.

### 3. Checkpoint 4.2: Pruebas Unitarias de Componentes y Servicios (`frontend/src/app/`)
* [ ] **Test-4.2.1 (Wallet Signals):** Comprobación de que la conexión simulada de wallet actualice `address()` y `isConnected()` de forma síncrona.
* [ ] **Test-4.2.2 (Escrow Signal Updates):** Comprobación de que la recepción de un evento SignalR actualice `currentOrder()` y derive correctamente `isFunded() = true`.
* [ ] **Test-4.2.3 (Form Validations):** Validación de que el formulario de publicación impida avanzar si falta el desafío fotográfico de Proof of Listing.
* [ ] **Test-4.2.4 (Ejecución de Tests):** `ng test --watch=false --browsers=ChromeHeadless` pasando con 100% de pruebas en verde.

---

## Fase 5: Integración End-to-End, Despliegue en HSK Testnet & Simulación de Escenarios Críticos (Ciclo de 15 Pasos)

### 1. Entregables de Construcción
1. **Despliegue Oficial en HSK Testnet:**
   * Despliegue de la suite completa de 5 smart contracts: `AyniProductPassport`, `AyniAgentRegistry`, `AyniEscrow`, `AyniSubscriptionManager` y `AyniChatBond` mediante script Foundry (`DeployAyniSuite.s.sol`).
   * Verificación de contratos en el explorador de bloques de HSK Testnet (`https://testnet.hsk.xyz`).
   * Configuración de variables de entorno productivas con las direcciones de los contratos desplegados.
2. **Script de Simulación E2E Automatizado (`e2e-simulation-hsk.ts`):**
   * Automatización del ciclo de vida completo de 15 pasos sobre HSK Testnet.

### 2. Checkpoint 5.1: 6-Layer Security Checklist (`solidity-checklist`)
* [ ] **Layer 1 (Permissions):** Confirmar que solo `AyniEscrow` tenga permisos de transferencia en `AyniProductPassport` y de retroalimentación en `AyniAgentRegistry`.
* [ ] **Layer 2 (Addresses):** Comprobar que las direcciones de tokens USDT y Permit2 en HSK Testnet sean oficiales y válidas.
* [ ] **Layer 3 (Privacy Integrity):** Auditar que ningún número de serie o IMEI se haya transmitido en texto claro en los parámetros de las transacciones ni en las respuestas del Seller Agent.
* [ ] **Layer 4 (Financial Safety):** Verificar que ningún saldo quede atrapado en el contrato de escrow ni en el contrato de chat bond tras reembolsos o cancelaciones.
* [ ] **Layer 5 (Network Resilience):** Confirmar que caídas momentáneas de red no corrompan el estado de la orden en ASP.NET Core.
* [ ] **Layer 6 (Evidence Logging):** Guardar hashes de transacción y capturas del explorador para el informe de demo final.

### 3. Checkpoint 5.2: Simulación y Aprobación de Escenarios Críticos del Ciclo de Vida
* [ ] **Scenario-5.2.1 (Suscripción Ayni Pro):** Vendedor adquiere Ayni Pro por 6.99 USDT en `AyniSubscriptionManager` -> 30 días de vigencia activa confirmados on-chain.
* [ ] **Scenario-5.2.2 (Publicación Verificada & Barrera de Privacidad):** Vendedor sube fotos y datos de hardware -> `product_verification_agent` procesa evidencia confidencial temporalmente -> Atestación `PASS` en Validation Registry -> `AyniProductPassport` (ERC-721) acuñado en HSK Testnet -> `seller_agent` recibe únicamente atributos públicos permitidos.
* [ ] **Scenario-5.2.3 (Chat Bond Anti-Spam & Negociación por Bandas):** Comprador deposita 0.30 USDT en `AyniChatBond` -> `seller_agent` atiende FAQs y evalúa oferta de $246 (auto-aceptación dentro de rango) -> Contador de respuestas mutuas incrementado.
* [ ] **Scenario-5.2.4 (Fondeo con Permit2):** Firma off-chain EIP-712 enviada -> Fondos bloqueados en `AyniEscrow` en HSK Testnet -> SignalR actualiza interfaz a `FUNDED`.
* [ ] **Scenario-5.2.5 (Safe Meet y Proof of Handoff):** Vendedor exhibe QR dinámico -> Comprador escanea en <60s -> Backend valida en Redis -> Estado pasa a `HANDOFF_CONFIRMED`.
* [ ] **Scenario-5.2.6 (Liquidación Atómica, Reembolso de Bono & Reputación):** `settleOrder()` transfiere USDT al vendedor, pasaporte NFT al comprador y registra feedback al agente en ERC-8004. Habiendo superado las 2 respuestas mutuas, `AyniChatBond` reembolsa el 100% (0.30 USDT) al comprador.
* [ ] **Scenario-5.2.7 (Flujo de Excepción / Disputa 2-de-3):** Comprador reporta defecto oculto -> Fondos congelados en `DISPUTED` -> Árbitro audita expediente y emite resolución 2-de-3 liberando o reembolsando fondos.
* [ ] **Scenario-5.2.8 (Abandono de Chat por Inactividad 24h):** Chat sin respuesta mutua tras 24 horas -> `AyniChatBond` retiene penalización de 0.15 USDT y reembolsa 0.15 USDT al depositante.

---

## Matriz de Trazabilidad con Requerimientos del Hackathon (`requiriments-project.txt`)

| Requerimiento Oficial | Implementación en la Arquitectura | Fase de Verificación |
|---|---|---|
| **HSK Chain Deployment** | Contratos desplegados y verificados en HSK Testnet (Chain ID 133). | Fase 1 y Fase 5 |
| **AI Agents / AI x Web3** | Ayni Seller Agent registrado bajo ERC-8004 con atestación de claims y reputación. | Fase 1, 2 y 5 |
| **Real-World P2P Applications** | Escrow no custodial para productos tecnológicos físicos con Safe Meet y QR dinámico. | Fase 3, 4 y 5 |
| **Privacy by Design** | Salted hash commitments de identificadores (`keccak256(imei, salt, seller)`) y MinIO interno. | Fase 1 y Fase 3 |
| **Working Demo & GitHub Repo** | Arquitectura reproducible con Docker Compose, suite de tests y scripts E2E. | Fase 0 y Fase 5 |
