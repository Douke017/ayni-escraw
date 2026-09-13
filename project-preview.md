# Ayni Trust Marketplace
## Especificación funcional consolidada v3
### Comercio P2P verificable para productos tecnológicos rastreables sobre HSK Chain

**Estado:** propuesta funcional y técnica para hackathon  
**Red objetivo:** HSK Chain testnet para el demo; HSK Chain mainnet como objetivo posterior  
**Moneda de demostración:** MockUSDT / ERC-20 de prueba  
**Agente de IA:** Ayni Seller Agent, registrado mediante ERC-8004  
**Video:** Ayni Video Verify integrado con 100ms  
**Nicho inicial:** celulares, laptops, componentes electrónicos rastreables y accesorios tecnológicos individualizables

> Este documento reemplaza las versiones anteriores. Define qué hace Ayni, qué no hace, las reglas de negocio, la máquina de estados, los escenarios de excepción y los límites técnicos y de responsabilidad del producto.

---

# 1. Resumen ejecutivo

Ayni Trust Marketplace es una plataforma de comercio P2P para artículos tecnológicos de alto valor o identificables. Busca reducir el riesgo de compra y venta entre desconocidos al integrar identidad basada en wallet, vendedores con credenciales reforzadas, publicación estructurada, prueba de posesión, inspección remota opcional, escrow no custodial, entrega verificable, pasaportes digitales de producto y resolución de conflictos bajo reglas explícitas.

El problema que aborda no es simplemente la falta de un medio de pago digital. En la compraventa P2P convencional, las señales de confianza están fragmentadas: la identidad está en un perfil, la conversación en WhatsApp, las fotos en redes sociales, el pago en una transferencia bancaria, la entrega en un punto informal y la disputa sin evidencia ordenada. Ayni crea una secuencia verificable que une esos actos.

Cada artículo tecnológico se tokeniza antes de venderse mediante un **Ayni Product Passport**. El token no declara que el artículo sea legal, auténtico, nuevo o libre de robo. Registra un compromiso criptográfico de su identificador, evidencia contextual de que el vendedor lo poseía al publicarlo, la condición declarada, los estados de venta y las transferencias realizadas dentro de Ayni.

El comprador puede solicitar una inspección remota llamada **Ayni Video Verify**, usando 100ms. Durante ella, vendedor y comprador revisan el equipo bajo un checklist guiado y un desafío dinámico. La sesión fortalece la confianza antes de reservar o financiar el escrow, pero no libera fondos automáticamente ni sustituye la inspección presencial.

El pago se bloquea en un contrato de escrow desplegado en HSK Chain. Durante la entrega presencial, comprador y vendedor utilizan un QR efímero y firmas de wallet. Si las validaciones son correctas, el contrato libera el pago y transfiere el Product Passport de forma atómica. Si existe una discrepancia material, se congela el escrow y se abre una disputa resoluble mediante firmas 2-de-3 entre comprador, vendedor y árbitro.

Ayni Pro Seller ofrece un agente de IA registrado mediante ERC-8004. El agente puede crear borradores de publicaciones, estructurar atributos, sugerir rango de precio, responder preguntas basadas en información confirmada y negociar dentro de políticas configuradas por el vendedor. No puede acceder a claves privadas, transferir fondos, liberar escrow, confirmar entrega, emitir identidad ni realizar cambios materiales sin autorización.

---

# 2. Problema

## 2.1 Riesgo en comercio P2P

En la compra y venta entre particulares, comprador y vendedor deben tomar decisiones de confianza sin infraestructura común. Los principales riesgos son:

- pago anticipado sin entrega;
- entrega de producto diferente al anunciado;
- comprobantes de pago falsos o no verificables;
- perfiles nuevos o desechables;
- publicaciones que reutilizan fotos de terceros;
- productos con serial, lote o IMEI repetido;
- defectos materiales no declarados;
- compradores que reservan, hacen perder tiempo y desaparecen;
- vendedores que aceptan una cita y no se presentan;
- chat y evidencia dispersos en sistemas externos;
- ausencia de un proceso claro de disputa y devolución;
- riesgo físico al reunirse con desconocidos.

## 2.2 Doble asimetría de confianza

El sistema debe proteger a ambos lados:

| Actor | Riesgo que sufre | Daño que también puede causar |
|---|---|---|
| Comprador | Pagar por un producto inexistente, falso, bloqueado, defectuoso o distinto | Recibir el producto y reclamar falsamente; reservar y abandonar; no presentarse |
| Vendedor | Entregar y no recibir pago; perder tiempo con bots y consultas desechables | Publicar producto inexistente, ocultar defectos, usar serial duplicado o no asistir |
| Plataforma | Manipulación de evidencia, ataques Sybil, abuso de reembolsos y fuga de datos | Custodia indebida, reglas opacas, exposición de información privada |
| Árbitro | Evidencia incompleta o versiones contradictorias | Colusión, negligencia o decisión unilateral injusta |
| Agente IA | Datos incompletos o entradas maliciosas | Alucinaciones, respuesta engañosa, acción fuera de permiso o exposición de datos |

## 2.3 Nicho tecnológico inicial

Ayni comenzará con bienes que tienen atributos verificables o comparables. Esto reduce ambigüedad y permite construir perfiles técnicos estructurados.

| Categoría | Ejemplos | Identificadores o señales útiles |
|---|---|---|
| Celulares | iPhone, Samsung, Xiaomi, Motorola, Google Pixel | IMEI, serial, modelo, almacenamiento, bloqueo de cuenta, batería, cámara, conectividad |
| Laptops | MacBook, ThinkPad, HP, Dell, ASUS, Lenovo | Serial, modelo, CPU, RAM, almacenamiento, batería, pantalla, puertos, bloqueo/BIOS si aplica |
| Componentes electrónicos rastreables | GPU, CPU, placa madre, consola, cámara, monitor, smartwatch | Serial, modelo, SKU, fotos de etiqueta, pruebas funcionales, puertos, firmware cuando aplica |
| Accesorios tecnológicos individualizables | Audífonos, teclados, mouse, docks, tablets gráficas | Serial si existe, modelo, lote/batch, fotos, conectividad, batería, pruebas funcionales |

La categoría no se admite solo porque sea “electrónica”. Debe tener un esquema de atributos y un checklist de condición. Si un artículo no es suficientemente individualizable, Ayni puede permitir publicación sin Product Passport transferible o dejarlo fuera del MVP.

---

# 3. Objetivos

## 3.1 Objetivo general

Diseñar e implementar una plataforma de comercio P2P verificable en HSK Chain para productos tecnológicos rastreables, que reduzca fraude, spam, incertidumbre de entrega y asimetría de información mediante escrow no custodial, pasaportes digitales de producto, evidencia contextual, inspección remota opcional, reputación bilateral y agentes de IA con identidad y permisos verificables.

## 3.2 Objetivos específicos

1. Implementar autenticación obligatoria mediante firma de wallet con nonce, dominio, chain ID y expiración.
2. Implementar niveles de confianza para compradores, vendedores y comercios.
3. Crear un Product Passport por artículo individualizable antes de publicarlo.
4. Registrar en HSK Chain solo commitments, hashes, estados y eventos mínimos; mantener IMEI, seriales, video, chat y evidencia fuera de cadena.
5. Implementar Proof of Listing con desafío dinámico y evidencia contextual de posesión.
6. Incorporar Ayni Video Verify como inspección remota precompra, con 100ms, consentimiento y checklist por categoría.
7. Implementar Bono de Intención Conversacional para limitar spam, abandono y bots.
8. Reutilizar el bono de conversación como bono de reserva, Safe Meet o crédito del escrow.
9. Implementar política de precio obligatoria y negociación limitada por parámetros del vendedor.
10. Implementar escrow, cita Safe Meet, QR efímero de entrega y settlement atómico en HSK Chain.
11. Implementar disputa con evidencia cifrada, estados auditables y resolución 2-de-3 sin IA decisora.
12. Registrar Ayni Seller Agent usando ERC-8004 Identity, Reputation y Validation Registry.
13. Ofrecer Ayni Pro Seller por 6.99 USDT/30 días sin dar al agente control financiero.
14. Publicar contratos, SDK, arquitectura, threat model, pruebas y demo reproducible en GitHub.

---

# 4. Decisiones y límites

## 4.1 Lo que Ayni sí hace

- Usa escrow no custodial para mantener pago bloqueado hasta entrega/resolución.
- Crea una cadena de procedencia y transferencia **dentro de Ayni**.
- Exige firma de wallet a toda persona que conversa, compra o vende.
- Exige credencial reforzada para vendedores de categorías de riesgo.
- Registra producto antes de su negociación formal.
- Permite inspección remota guiada antes de comprar.
- Facilita chat, oferta formal, reserva, cita y evidencia asociada.
- Penaliza abandono silencioso bajo reglas conocidas.
- Permite a un agente asistir y negociar dentro de mandato explícito.

## 4.2 Lo que Ayni no hace

- No es custodio de wallets ni guarda seed phrases o claves privadas.
- No convierte bolivianos a stablecoins ni opera como exchange.
- No garantiza que un producto sea original, legal o no robado.
- No declara que un Product Passport sea título legal de propiedad.
- No publica IMEI, serial, fotos, videos, chat, ubicación exacta, CI, rostro o biometría en blockchain.
- No usa biometría ni reconocimiento facial en la primera versión.
- No graba videollamadas por defecto.
- No libera fondos solo porque dos personas participaron de una llamada.
- No permite que la IA decida disputas, confirme entrega o controle dinero.
- No ofrece seguro, logística, delivery propio, lockers o seguridad física.
- No permite pagos externos como condición para cerrar un escrow.
- No implementa AMM, DEX, préstamos, inversión colectiva ni tokenización financiera.

## 4.3 Principios técnicos

1. **Wallet control is not civil identity.** Una firma valida control criptográfico de una dirección; no valida nombre legal ni unicidad humana.
2. **On-chain minimum.** Blockchain recibe lo mínimo indispensable para settlement e integridad.
3. **Off-chain protected evidence.** Archivos sensibles permanecen cifrados fuera de cadena.
4. **Deterministic money movement.** El contrato y firmas humanas controlan dinero; el LLM jamás.
5. **Explicit policy.** Precio mínimo, expiración, condiciones y penalizaciones se definen antes de actuar.
6. **No magic physical-world claims.** Ayni registra evidencia; no convierte declaraciones en verdad objetiva.

---

# 5. Actores, autenticación y confianza

## 5.1 Actores

| Actor | Acciones permitidas | Restricciones |
|---|---|---|
| Visitante | Explorar catálogo | No conversa, reserva, compra ni vende |
| Comprador L0 | Firma wallet, abre chat bajo bono, realiza oferta | Máximo bajo de chats; no vende bienes de alto valor |
| Comprador L1 | Compra, reserva, agenda y usa Video Verify | Límites según reputación; sigue sujeto a bonos/riesgo |
| Vendedor L2 | Publica productos tecnológicos rastreables | Debe tener VC vigente; no libera escrow |
| Comercio L3 | Gestiona inventario y mayor volumen | Fase posterior; controles reforzados |
| Árbitro | Cofirma decisiones de disputa | No mueve fondos unilateralmente |
| Emisor de VC | Emite/revoca credencial de vendedor | No controla fondos |
| Ayni Seller Agent | Genera y opera publicación bajo política | Sin llaves, settlement, identidad ni autoridad de disputa |
| Administrador | Parámetros, emisores y suspensión de emergencia | No puede extraer escrow de usuarios |

## 5.2 Login por wallet

Proceso:

1. Usuario conecta wallet compatible con HSK Chain.
2. Backend genera nonce aleatorio de un solo uso.
3. La aplicación muestra un mensaje legible que contiene dominio, URI, chain ID, wallet, nonce, `issuedAt` y `expirationTime`.
4. Usuario firma off-chain; no paga gas.
5. Backend verifica firma y asocia sesión a wallet.
6. Backend invalida nonce.
7. Cualquier intento de reuso del nonce se rechaza.

Mensaje recomendado:

> “Firmo para autenticar que controlo esta wallet en Ayni. Esta firma no transfiere fondos, no revela claves, no crea una compra y no autoriza un pago.”

## 5.3 Niveles

| Nivel | Evidencia | Acciones | Regla principal |
|---|---|---|---|
| L0 | Wallet firmada | Explorar, chat, oferta con límite | Bono y rate limits obligatorios |
| L1 | Historial positivo/señales persistentes | Más chats, reservas, Video Verify | Más capacidad, no confianza ilimitada |
| L2 | VC de vendedor vigente | Publicar y recibir settlement | Requerido para categorías del MVP |
| L3 | VC de comercio, etapa futura | Inventario y volumen | No elimina controles de producto/escrow |

---

# 6. Tokenización: Ayni Product Passport

## 6.1 Definición

Ayni Product Passport es un token de procedencia y estado para un artículo físico individualizable. Para el nicho inicial se utiliza **ERC-721** porque cada celular, laptop, componente o accesorio específico debe tener un pasaporte único.

No representa una acción, valor financiero ni propiedad legal. Su función es:

- vincular una publicación con un objeto declarado;
- conservar compromiso de identificador sin exponerlo;
- registrar condición declarada y hashes de evidencia;
- impedir doble venta activa dentro de Ayni;
- vincular el objeto a una orden de escrow;
- transferir historial Ayni al comprador cuando la entrega se confirma;
- congelarse ante disputa o alerta.

## 6.2 Datos on-chain y off-chain

| Tipo de información | Ejemplos | Ubicación |
|---|---|---|
| Estado verificable | LISTED, ESCROW_FUNDED, DISPUTED, DELIVERED | HSK Chain |
| Integridad | Hash de perfil técnico, checklist y evidencia | HSK Chain |
| Compromiso de identificador | `productCommitment` de IMEI/serial/lote | HSK Chain |
| Relaciones | Passport ID, order ID, wallets participantes | HSK Chain |
| Perfil público | Marca, modelo, capacidad, color, condición declarada | App/indexador, firmado y versionado |
| Datos privados | IMEI completo, serial completo, videos, fotos de etiqueta, ubicación | Vault cifrado off-chain |
| Datos prohibidos on-chain | Biometría, CI, rostros, video/audio, chat, dirección exacta | Nunca on-chain |

Estructura mínima:

```solidity
struct ProductPassport {
    uint256 tokenId;
    bytes32 productCommitment;
    bytes32 technicalProfileHash;
    bytes32 conditionHash;
    bytes32 listingEvidenceHash;
    address originSeller;
    uint64 createdAt;
    ProductState state;
    uint256 activeOrderId;
}
```

## 6.3 Perfil técnico versionado

No se crearán tokens distintos para IMEI, batería, cámara, RAM, teclado o accesorios. Se usa un ERC-721 único y un perfil técnico versionado por categoría.

```text
ProductPassport ERC-721
  ├── category: SMARTPHONE | LAPTOP | COMPONENT | ACCESSORY
  ├── schemaVersion: ayni.smartphone.v1
  ├── technicalProfileHash
  ├── conditionHash
  ├── evidenceHash
  ├── productCommitment
  └── state
```

### Esquemas iniciales

| Esquema | Campos mínimos |
|---|---|
| `ayni.smartphone.v1` | Marca, modelo, almacenamiento, color, IMEI/serial commitment, pantalla, cámaras, carga, conectividad, bloqueo de cuenta, accesorios |
| `ayni.laptop.v1` | Marca, modelo, CPU, RAM, almacenamiento, pantalla, batería, teclado, puertos, serial commitment, bloqueo/BIOS declarado |
| `ayni.component.v1` | Tipo, marca, modelo, serial, interfaz, compatibilidad, estado funcional, evidencia de prueba |
| `ayni.accessory.v1` | Tipo, marca, modelo, serial/lote si existe, conectividad, batería si aplica, estado y accesorios |

## 6.4 Reglas de Product Passport

1. Un identificador normalizado no puede tener dos pasaportes activos.
2. Un pasaporte solo puede tener una orden financiada a la vez.
3. Un pasaporte no puede transferirse libremente mientras esté en `RESERVED`, `ESCROW_FUNDED`, `HANDOFF_PENDING` o `DISPUTED`.
4. El token se transfiere al comprador solo con settlement válido.
5. Si existe alerta, se marca `FLAGGED`; no se borra historial.
6. El vendedor puede actualizar información no material antes de escrow; cambios materiales invalidan oferta/Video Verify y requieren nueva confirmación.
7. No se puede editar IMEI/serial una vez creado el pasaporte. Un error requiere invalidar/retirar y crear flujo de corrección auditado.

---

# 7. Proof of Listing

## 7.1 Objetivo

Proof of Listing reduce publicaciones con fotos genéricas, productos inexistentes o evidencia reutilizada. No prueba propiedad legal; evidencia que el vendedor mostró un objeto compatible con su publicación en un momento determinado.

## 7.2 Flujo

1. Vendedor L2 selecciona categoría y completa campos obligatorios.
2. Ayni Seller Agent puede generar borrador, pero vendedor confirma cada atributo material.
3. Sistema genera desafío dinámico de corta vigencia, por ejemplo `AYNI-LIST-9X4K`.
4. Vendedor captura fotos/video breve mostrando producto y desafío.
5. Vendedor muestra identificador aplicable dentro de una pantalla guiada, sin publicarlo.
6. Sistema valida que checklist esté completo.
7. Backend normaliza identificador en entorno privado y busca duplicado interno.
8. Backend calcula `productCommitment`, hash de perfil, condición y evidencia.
9. Vendedor firma declaración de atributos.
10. Se acuña Product Passport y publicación pasa a `LISTED`.

## 7.3 Si ocurre un problema

| Situación | Acción |
|---|---|
| Faltan atributos obligatorios | No se publica ni tokeniza final |
| Desafío no aparece en evidencia | Evidencia inválida; repetir captura |
| IMEI/serial ya existe activo | Bloquear publicación y solicitar revisión |
| Perfil técnico no coincide con fotos/evidencia | Estado de borrador; pedir corrección |
| Vendedor intenta cambiar modelo o serial luego | Debe invalidar publicación y crear nueva versión/pasaporte según política |
| Se denuncia publicación | `FLAGGED`; se congelan nuevas acciones según severidad |

---

# 8. Ayni Video Verify con 100ms

## 8.1 Propósito y decisión

Ayni Video Verify es una inspección remota opcional **antes de comprar**. Se integra con 100ms para crear salas temporales de videollamada entre comprador y vendedor.

No es autenticación biométrica, no es KYC, no es arbitraje automatizado, no permite liberar escrow por sí sola y no se graba por defecto.

## 8.2 Casos permitidos

| Tipo de sala | Finalidad | Participantes | Resultado |
|---|---|---|---|
| `PRE_PURCHASE_INSPECTION` | Inspeccionar producto antes de oferta/escrow | Comprador + vendedor | Construye confianza; no mueve fondos |
| `CONCILIATION_CALL` | Intentar acuerdo tras intentos fallidos o desacuerdo | Comprador + vendedor; árbitro opcional | Acuerdo mutuo o transición a disputa |
| `REMOTE_HANDOFF` | Fase futura para courier/envío | Comprador + vendedor; courier opcional | Evidencia complementaria, no settlement automático |

El MVP implementa **solo `PRE_PURCHASE_INSPECTION`** y el flujo de conciliación como estado/documentación si no hay capacidad de implementar sala adicional.

## 8.3 Flujo A: inspección antes de comprar

```text
1. Comprador inicia chat y bloquea Chat Bond.
2. Comprador solicita Video Verify.
3. Vendedor acepta, rechaza o propone horario alternativo.
4. Ambos confirman franja de videollamada.
5. Backend crea una sala 100ms temporal.
6. Backend genera tokens de acceso de corta duración con roles Buyer/Seller.
7. Ambos ingresan; backend registra eventos de sala.
8. App muestra checklist guiado según categoría.
9. Vendedor muestra producto y desafío dinámico de sesión.
10. Comprador selecciona: satisfecho, requiere información, no continuar o realizar oferta.
11. Si ambos cierran/declinan explícitamente, Chat Bond se devuelve.
12. Si hay acuerdo, comprador presenta oferta, reserva o financia escrow.
```

## 8.4 Checklist de Video Verify

### Celular

- Mostrar dispositivo físico y encendido.
- Mostrar marca/modelo en ajustes.
- Mostrar almacenamiento declarado.
- Mostrar pantalla y bordes.
- Probar cámara frontal/trasera.
- Probar carga, Wi-Fi/Bluetooth u otros elementos declarados.
- Mostrar pantalla de IMEI/serial bajo interfaz guiada.
- Mostrar estado de bloqueo de cuenta declarado.
- Mostrar accesorios incluidos.
- Mostrar desafío dinámico activo.

### Laptop

- Mostrar equipo, pantalla, teclado, trackpad y puertos.
- Mostrar información de sistema: modelo, CPU, RAM y almacenamiento declarado.
- Mostrar estado de batería si el sistema lo permite.
- Probar encendido, Wi-Fi y cámara/micrófono si fueron declarados.
- Mostrar serial de forma controlada.
- Mostrar desafío dinámico activo.

### Componente electrónico

- Mostrar componente y etiquetas/serial si existe.
- Mostrar interfaz/puertos relevantes.
- Mostrar prueba funcional compatible cuando sea razonable.
- Mostrar desafío dinámico.

### Accesorio

- Mostrar accesorio, modelo, serial/lote si aplica.
- Probar conexión, carga, audio, teclas, sensores o funciones relevantes.
- Mostrar desafío dinámico.

## 8.5 Reglas de llamada

| Regla | Definición |
|---|---|
| Sala temporal | Se crea solo para una cita aceptada y expira al terminar la ventana |
| Roles | Buyer/Seller tienen permisos mínimos; backend no expone credenciales administrativas |
| Grabación | Desactivada por defecto |
| Consentimiento | Requerido de ambos antes de grabar cualquier sala |
| Evidencia de sesión | Se registra `roomId`, timestamps, participantes pseudonimizados, estado, checklist hash y consentimiento; no video por defecto |
| Almacenamiento | Si hay grabación consentida, se cifra y retiene plazo limitado; acceso auditado |
| Desafío dinámico | Debe mostrarse junto a producto; expira con sala |
| Pago | La llamada no inicia ni autoriza settlement |

## 8.6 Dos intentos y conciliación

Un intento de llamada se considera válido únicamente si:

1. hubo una cita aceptada por ambas partes;
2. la sala se generó por Ayni;
3. existió una ventana de tolerancia de 10 minutos;
4. el token de cada participante fue emitido correctamente;
5. no se detectó caída general de 100ms o incidente conocido de Ayni;
6. la parte ausente no reprogramó dentro de la política acordada.

| Escenario | Primer intento | Segundo intento | Resultado |
|---|---|---|---|
| Ambos conectan | Inspección completada | No aplica | Pueden ofertar o continuar |
| Vendedor no ingresa | Reprogramar | Ausencia repetida | Comprador puede cerrar/recuperar bono; señal negativa vendedor |
| Comprador no ingresa | Reprogramar | Ausencia repetida | Vendedor puede cerrar; reglas de inactividad aplican |
| Ambos acuerdan reprogramar | No penalizar | Nueva cita | Mantener bono si no expira |
| Falla técnica demostrable | Reprogramar | Sin penalización automática | Registrar incidencia |
| Vendedor se niega a mostrar artículo/checklist | Sesión incompleta | Reintento opcional | Comprador puede no continuar; no se libera dinero |
| Producto no coincide | No continuar | No requiere segundo intento | No hay escrow o comprador abre disputa si ya existe |

Después de dos intentos válidos fallidos, estado `CONCILIATION_OPEN`:

```text
CONCILIATION_OPEN
  ├── Ambos acuerdan nueva cita → VIDEO_VERIFY_SCHEDULED
  ├── Ambos acuerdan cancelar → bono/orden se resuelve por regla
  ├── Existe escrow + desacuerdo → DISPUTED
  └── No existe escrow → reserva/chat se resuelve por estado y expiración
```

---

# 9. Chat, Bono de Intención, reserva y Safe Meet

## 9.1 Bono de Intención Conversacional

El comprador bloquea 0.30 USDT para abrir un nuevo chat sobre una publicación. El bono introduce costo de oportunidad para bots y compradores que abandonan silenciosamente, pero no debe castigar a quien declina explícitamente.

El bono se asocia a:

```text
interactionId
buyerWallet
sellerWallet
listingId
passportId
amount
purpose
status
createdAt
expiresAt
```

## 9.2 Estados

```text
CHAT_BOND_LOCKED
  ├── SELLER_TIMEOUT → REFUNDED_TO_BUYER
  ├── SELLER_RESPONDED
  │     ├── BUYER_CLOSED_EXPLICITLY → REFUNDED_TO_BUYER
  │     ├── BUYER_SILENT_TIMEOUT → PENALIZED
  │     ├── VIDEO_VERIFY_SCHEDULED
  │     ├── RESERVATION_BOND
  │     └── ESCROW_CREDIT
  └── SELLER_CANCELLED → REFUNDED_TO_BUYER
```

## 9.3 Respuesta válida

Solo una respuesta útil activa la obligación de comprador de responder o cerrar. Respuesta útil puede:

- contestar una pregunta específica;
- incluir disponibilidad, condición, precio o alternativa de cita;
- responder desde el agente citando datos confirmados;
- proponer una acción verificable: oferta, Video Verify o Safe Meet.

No son válidas para penalización: saludo genérico, emoji, sticker, mensaje vacío o respuesta automática sin datos del producto.

## 9.4 Regla de abandono

| Situación | Acción del bono |
|---|---|
| Vendedor no responde en 12 h | Devolución 100% a comprador |
| Comprador cierra explícitamente en 24 h tras respuesta útil | Devolución 100% a comprador |
| Comprador responde, oferta, agenda o reserva | Bono permanece activo/reutilizable |
| Comprador desaparece 24 h tras respuesta útil | Penalización: 0.20 USDT vendedor, 0.10 USDT protocolo |
| Vendedor abandona conversación activa 24 h | Devolución a comprador; señal negativa vendedor |
| Compra completada | Bono se acredita al escrow o devuelve según orden |

## 9.5 Reserva temporal

El mismo bono puede cambiar a `RESERVATION_BOND` cuando:

- el vendedor acepta reserva;
- existe oferta válida o intención concreta;
- se define duración de reserva de 2–12 h;
- el producto queda marcado `RESERVED`.

Si comprador no continúa tras reserva, se aplica regla acordada. Si vendedor vende a tercero durante reserva válida, comprador recibe devolución y vendedor obtiene señal negativa.

## 9.6 Safe Meet

Safe Meet permite acordar entrega presencial sin revelar ubicación exacta públicamente.

La cita registra:

- zona general;
- ventana de tiempo;
- tolerancia;
- aceptación de ambos;
- orden vinculada;
- bono reutilizado;
- ubicación exacta compartida solo cuando la política lo permite.

Ayni puede sugerir sitios de encuentro, pero no garantiza seguridad física, vigilancia ni responsabilidad por incidentes.

---

# 10. Precio obligatorio, oferta y negociación

## 10.1 Regla de precio

Cada publicación debe tener precio visible obligatorio en USDT/MockUSDT. Se puede mostrar una referencia en bolivianos con fecha, hora y fuente, pero el importe de escrow se expresa en el token admitido.

No se permiten publicaciones con “oferta”, “precio por inbox”, “consultar” o “al mejor postor” sin precio de lista.

## 10.2 Política de negociación

El vendedor configura:

```json
{
  "listPrice": 250,
  "currency": "USDT",
  "minimumAcceptablePrice": 220,
  "autoAcceptAtOrAbove": 245,
  "maximumDiscountPercent": 12,
  "negotiationEnabled": true,
  "requiresSellerApprovalBelow": 245,
  "offerExpiryHours": 12
}
```

| Oferta | Acción permitida |
|---|---|
| Igual/superior al precio de lista | Aceptar según disponibilidad |
| Igual/superior a autoaceptación | Agente puede aceptar si política lo permite |
| Entre mínimo y umbral | Agente contraoferta o solicita aprobación humana |
| Bajo mínimo | Rechazo automático educado |
| Oferta vencida | No crea derecho de compra |
| Precio cambiado post-escrow | Prohibido; orden conserva precio acordado |

El agente puede recomendar rango, pero el vendedor define precio y mínimos. Ayni no realiza tasación oficial.

---

# 11. Escrow, entrega y settlement

## 11.1 Creación de orden

Tras oferta aceptada, el comprador crea/fondea escrow.

```text
orderId
passportId
buyer
seller
paymentToken
agreedAmount
bondCredit
amountToDeposit
platformFee
orderExpiry
deliveryWindow
status
```

Antes de firmar, la interfaz muestra importe, token, comisión, bono aplicado, valor neto de vendedor, vencimiento, causal de disputa y producto asociado.

## 11.2 Estados de orden

```text
CREATED
FUNDED
MEET_SCHEDULED
HANDOFF_PENDING
DELIVERY_CONFIRMED
SETTLED
DISPUTED
REFUNDED
PARTIALLY_SETTLED
EXPIRED
CANCELLED
```

## 11.3 Proof of Handoff

La entrega presencial se confirma así:

1. Vendedor abre orden `FUNDED`.
2. App genera QR de un solo uso con `orderId`, `passportId`, buyer, seller, nonce y expiración corta.
3. Comprador revisa físicamente producto y serial/IMEI.
4. Comprador escanea QR.
5. Comprador completa checklist final y firma confirmación.
6. Contrato valida firma, estado, wallets, pasaporte, nonce y expiración.
7. Contrato libera pago y transfiere passport atómicamente.

**No se utiliza PIN estático.** El QR efímero y la firma ligan la confirmación a una orden y momento específicos.

## 11.4 Rechazos obligatorios de contrato

El contrato rechaza si:

- orden no está financiada;
- QR expiró;
- nonce ya se usó;
- wallet no corresponde a comprador/vendedor;
- pasaporte no pertenece a orden;
- orden está disputada/cancelada/expirada;
- token o monto no corresponde;
- pasaporte está `FLAGGED` o estado no permite entrega;
- firma es inválida.

---

# 12. Disputas y conciliación

## 12.1 Decisión

Ayni no utiliza IA para decidir disputas. La IA no analiza ni recomienda fallos en esta fase. La decisión se basa en reglas, evidencia y firmas humanas.

## 12.2 Causales

| Código | Causal |
|---|---|
| D01 | No entrega |
| D02 | Producto distinto |
| D03 | Defecto material no declarado |
| D04 | IMEI/serial no coincidente |
| D05 | Bloqueo de cuenta no declarado |
| D06 | No-show comprador |
| D07 | No-show vendedor |

No proceden disputas por cambio de opinión posterior a confirmación, precio encontrado en otra publicación o falta de gusto no vinculada a condición declarada.

## 12.3 Flujo

1. Parte selecciona causal habilitada.
2. Adjunta evidencia cifrada: fotos, checklist, chat interno, logs de cita o datos permitidos.
3. Sistema registra hash/tipo/autor/timestamp del archivo.
4. Orden y pasaporte pasan a `DISPUTED`.
5. Contraparte tiene plazo de respuesta.
6. Se intenta conciliación voluntaria si ambas partes aceptan.
7. Si no hay acuerdo, comprador/vendedor y árbitro usan firmas 2-de-3.
8. Contrato ejecuta resultado firmado.

## 12.4 Resolución 2-de-3

```text
resolutionHash = hash(
  orderId,
  outcome,
  buyerAmount,
  sellerAmount,
  passportRecipient,
  rationaleHash,
  expiresAt
)
```

Resultados: liberación total, reembolso total, distribución parcial o cancelación. El árbitro no puede mover fondos sin cofirma de una parte.

---

# 13. Ayni Seller Agent y ERC-8004

## 13.1 Suscripción

**Ayni Pro Seller:** 6.99 USDT por 30 días.

- Activación tras pago manual firmado.
- Sin renovación automática en MVP.
- Renovación futura solo con autorización explícita y revocable.
- La suscripción no concede al agente permisos financieros.

## 13.2 Capacidades

- Extraer atributos desde voz/texto/formulario.
- Generar título y descripción revisables.
- Generar checklist de categoría.
- Solicitar información faltante.
- Sugerir rango de precio.
- Responder FAQs con datos confirmados.
- Contraofertar dentro de política.
- Proponer Video Verify o Safe Meet.
- Recordar expiraciones/citas al vendedor.

## 13.3 Prohibiciones

- No accede a claves privadas, seed phrase, token de firma o wallet del usuario.
- No financia, libera o reembolsa escrow.
- No confirma entrega.
- No cambia precio fuera de política ni edita datos materiales sin confirmación.
- No altera fotos de evidencia.
- No emite credenciales de identidad.
- No declara autenticidad, propiedad legal, ausencia de robo o condición perfecta sin respaldo.
- No participa en decisión de disputa.

## 13.4 ERC-8004

### Identity Registry

Registra identidad y capacidades del Ayni Seller Agent. `agentURI` incluye nombre, versión, endpoints, capacidades y prohibiciones.

### Reputation Registry

Registra señales solo desde acciones verificables: publicación aprobada, correcciones, validaciones fallidas, negociación dentro de rango y quejas vinculadas a órdenes.

### Validation Registry

Valida que el texto generado no contenga claims no respaldados por campos confirmados.

| Resultado | Efecto |
|---|---|
| PASS | Publicación puede continuar |
| WARN | Vendedor debe confirmar/corregir claim |
| FAIL | Bloquea publicación hasta corregir |

Claims prohibidos sin prueba: “original garantizado”, “sin fallas”, “IMEI limpio”, “nunca reparado”, “como nuevo”, “libre de iCloud/FRP” sin confirmación.

---

# 14. Reputación y moderación

## 14.1 Reputación bilateral

El sistema muestra hechos, no un número mágico.

| Perfil | Métricas |
|---|---|
| Comprador | Compras, reservas completadas, abandonos silenciosos, no-show, disputas y tiempo de respuesta |
| Vendedor | Ventas, valor liquidado, tiempo de respuesta, no-show, disputas, pasaportes flaggeados y credencial vigente |
| Agente | Aprobaciones sin corrección, errores de atributos, negociaciones correctas, validaciones PASS/WARN/FAIL |

## 14.2 Alertas

- Serial/IMEI duplicado.
- Publicación con datos incompatibles.
- Solicitud de pago fuera de escrow.
- Solicitud de seed phrase o códigos de wallet.
- Repetición de fotos/posible evidencia reciclada.
- Patrón de no-show.
- Comportamiento de chat masivo.

Una alerta no es sentencia de fraude. Debe bloquear o limitar según severidad y preservar evidencia para revisión.

---

# 15. Requerimientos funcionales

| ID | Requerimiento |
|---|---|
| RF-01 | Autenticación obligatoria por wallet con nonce de un uso. |
| RF-02 | Gestión de niveles L0-L3 y credenciales L2 para vendedores. |
| RF-03 | Chat vinculado a publicación con Bono de Intención de 0.30 USDT. |
| RF-04 | Devolución por seller timeout y cierre explícito. |
| RF-05 | Penalización solo por abandono silencioso tras respuesta válida. |
| RF-06 | Reutilización de bono para reserva, cita o escrow. |
| RF-07 | Publicación por categoría tecnológica con campos/checklist requeridos. |
| RF-08 | Precio de lista obligatorio y política de negociación. |
| RF-09 | Creación de Product Passport ERC-721 antes de venta. |
| RF-10 | Commitment de identificador y bloqueo de duplicados internos. |
| RF-11 | Proof of Listing con desafío dinámico y evidencia cifrada. |
| RF-12 | Video Verify precompra con 100ms y checklist. |
| RF-13 | Registro de dos intentos válidos y estado de conciliación. |
| RF-14 | Oferta formal con expiración y aceptación bajo política. |
| RF-15 | Escrow ERC-20 en HSK Chain. |
| RF-16 | Safe Meet con cita aceptada y ubicación privada. |
| RF-17 | QR efímero para Proof of Handoff. |
| RF-18 | Settlement atómico: pago + transferencia de Passport. |
| RF-19 | Disputas por causales definidas y evidencia cifrada. |
| RF-20 | Resolución 2-de-3. |
| RF-21 | Suscripción Pro de 6.99 USDT por 30 días. |
| RF-22 | Registro ERC-8004 del agente. |
| RF-23 | Reputation Registry y Validation Registry funcionales. |
| RF-24 | Moderación, alertas y reputación bilateral. |

---

# 16. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | Contratos con checks-effects-interactions, control de acceso y protección reentrancy. |
| RNF-02 | Pruebas de estados válidos/inválidos para escrow, bono, passport y disputas. |
| RNF-03 | No almacenar claves privadas en ningún componente. |
| RNF-04 | Cifrar evidencia antes de persistir fuera de cadena. |
| RNF-05 | Datos mínimos on-chain: hashes, commitments, estados, importes, wallets y timestamps. |
| RNF-06 | Video no se graba por defecto; grabación requiere consentimiento mutuo. |
| RNF-07 | Retención de grabaciones consentidas limitada y auditable. |
| RNF-08 | Salidas del LLM validadas por JSON Schema/Zod. |
| RNF-09 | Agente con mínimo privilegio y sin herramientas de settlement. |
| RNF-10 | Operaciones backend idempotentes y con manejo de timeout/retry. |
| RNF-11 | Indexador capaz de reconstruir estados desde eventos HSK. |
| RNF-12 | Interfaz mobile-first y mensajes claros antes de toda firma. |
| RNF-13 | Todos los mocks, especialmente consulta IMEI externa, deben etiquetarse. |
| RNF-14 | Repositorio público con contratos, pruebas, SDK, documentación, C4, ADR y threat model. |

---

# 17. Escenarios críticos

## 17.1 Video Verify

| Qué pasa si… | Resultado |
|---|---|
| Vendedor no acepta videollamada | Comprador puede continuar con otro método o cerrar; no hay penalización automática |
| Vendedor acepta pero no ingresa dos veces | Comprador recupera bono; vendedor recibe señal negativa |
| Comprador acepta pero no ingresa dos veces | Vendedor puede cerrar; aplica política de no-show/inactividad |
| Hay falla técnica general | Se reprograma; no penalización |
| Vendedor no muestra dispositivo/desafío | Inspección marcada incompleta; comprador puede no continuar |
| Producto no coincide durante llamada | Comprador no financia escrow o abre disputa si ya estaba financiado |
| Uno pide grabar | Ambas partes deben consentir; si una rechaza, la llamada continúa sin grabación o se cancela sin penalidad |

## 17.2 Tokenización

| Qué pasa si… | Resultado |
|---|---|
| Identificador existe activo | No se acuña nuevo Passport; se abre revisión |
| Vendedor cambia serial luego de tokenizar | No se edita; se retira/invalida flujo y se crea registro auditado |
| Vendedor intenta transferir token durante escrow | Contrato rechaza |
| Producto es reportado | Passport se marca FLAGGED; no se borra historial |
| Se descubre que serial era de otro dispositivo | Disputa/alerta; no se afirma crimen automáticamente |

## 17.3 Chat/bono

| Qué pasa si… | Resultado |
|---|---|
| Vendedor no responde 12 h | Bono 100% al comprador |
| Comprador cierra explícitamente | Bono 100% al comprador |
| Comprador desaparece tras respuesta útil | 0.20 vendedor / 0.10 protocolo; reputación afectada |
| Agente envía saludo genérico | No activa penalidad |
| Comprador realiza compra | Bono se acredita/retorna una sola vez |

## 17.4 Entrega/escrow

| Qué pasa si… | Resultado |
|---|---|
| QR expira | No hay settlement; se genera nuevo QR |
| Comprador detecta IMEI distinto | No confirma; abre disputa D04 |
| Comprador firma confirmación | Settlement se ejecuta; no revocación unilateral |
| Vendedor no se presenta | Causal D07 y reglas de bono/orden |
| Comprador no se presenta | Causal D06 y reglas de bono/orden |
| Una parte quiere pago por fuera | Advertencia, posible flag; escrow no se cierra por chat externo |

---

# 18. Flujo de venta exitoso

```text
1. Vendedor conecta wallet y acredita L2.
2. Activa Ayni Pro si desea agente.
3. Selecciona categoría: celular/laptop/componente/accesorio.
4. Carga datos y fotos; agente prepara borrador.
5. Vendedor confirma atributos, precio y política de negociación.
6. Validation Registry produce PASS/WARN/FAIL.
7. Vendedor realiza Proof of Listing.
8. Backend crea commitments; se acuña Product Passport en HSK Chain.
9. Comprador firma wallet y bloquea Chat Bond.
10. Comprador solicita Video Verify precompra.
11. Vendedor acepta y ambos completan inspección 100ms.
12. Comprador realiza oferta; agente negocia dentro de política.
13. Se acepta monto; comprador financia escrow usando bono como crédito.
14. Ambos agendan Safe Meet.
15. Vendedor muestra producto; comprador inspecciona y verifica serial.
16. Vendedor genera QR efímero.
17. Comprador escanea QR y firma recepción.
18. Contrato libera MockUSDT y transfiere Product Passport.
19. Eventos actualizan reputación de comprador, vendedor y agente.
```

---

# 19. Arquitectura de alto nivel

```text
┌───────────────────────────────────────────────────────────────┐
│ Ayni Web/Mobile                                                │
│ Marketplace · Wallet · Chat · Video Verify · Safe Meet         │
│ Listing Wizard · Product Passport · Escrow · Reputation        │
└───────────────┬───────────────────┬───────────────────────────┘
                │                   │
                ▼                   ▼
┌────────────────────────┐  ┌─────────────────────────────────┐
│ 100ms Video Service     │  │ Ayni API + Policy Engine        │
│ Rooms · Roles · Events  │  │ Auth · Listing · Chat SLA       │
└────────────────────────┘  │ Pricing · Indexer · Risk         │
                            └─────────────┬───────────────────┘
                                          │
                    ┌─────────────────────┼───────────────────────┐
                    ▼                     ▼                       ▼
          ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐
          │ Ayni Seller Agent│  │ Evidence Vault     │  │ HSK Chain            │
          │ LLM off-chain    │  │ Encrypted offchain │  │ Escrow · Passport    │
          │ ERC-8004 profile │  │ Video opt-in       │  │ ChatBond · VC verify │
          └──────────────────┘  └────────────────────┘  │ ERC-8004 registries  │
                                                        └──────────────────────┘
```

---

# 20. Demo mínimo evaluable

## Flujo principal

1. Registrar vendedor L2 y activar Ayni Pro.
2. Usar agente para crear publicación de smartphone.
3. Mostrar validation WARN ante claim no respaldado y corrección manual.
4. Ejecutar Proof of Listing y acuñar Passport.
5. Iniciar chat con bono.
6. Completar Video Verify de inspección precompra usando 100ms.
7. Negociar dentro de política y crear escrow en HSK Chain.
8. Ejecutar Safe Meet/QR y mostrar settlement atómico.

## Flujos adversariales

Mostrar al menos tres:

- IMEI/serial duplicado bloqueado.
- Comprador silencioso después de respuesta útil: bono penalizado.
- Vendedor que no responde: bono devuelto.
- QR vencido: contract revert.
- Agente intentando aceptar oferta inferior al mínimo: policy engine bloquea.
- Dos llamadas válidas no completadas: `CONCILIATION_OPEN`.
- Producto reportado: Passport `FLAGGED` no transferible.

---

# 21. Alineación con tracks

| Track | Evidencia de Ayni |
|---|---|
| HSK AI Agents | Agente vendedor con ERC-8004 Identity, Reputation y Validation Registry |
| HSK AI × Web3 | El agente opera off-chain bajo políticas y produce efectos verificables on-chain |
| HSK Payment | Chat Bond, reserva, escrow, settlement y suscripción Pro en HSK Chain |
| HSK Stablecoins | MockUSDT/ERC-20 para pago transparente en demo |
| HSK Blockchain Infrastructure | Contratos, SDK, Product Passport, policy engine e indexador reutilizables |
| EAG AI x Ethereum & Agent Economy | Agente con identidad, reputación, validación y mandato limitado |
| EAG Application Middleware | Componentes reutilizables de escrow, pasaporte, bonos y políticas |
| EAG Real-World Applications | Comercio P2P tecnológico con relevancia en Bolivia y expansión LatAm |
| EAG Private AI & User-Owned Data | Evidencia cifrada, video por consentimiento y mínimo dato on-chain |

---

# 22. Referencias técnicas

- [ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8004 contract reference](https://github.com/erc-8004/erc-8004-contracts)
- [HSK Chain](https://group.hashkey.com/hashkey-chain/)
- [HSK Chain solutions](https://hskchain.net/solutions)
- [100ms Documentation](https://www.100ms.live/docs)
- [100ms Video KYC / recording configuration](https://www.100ms.live/docs/get-started/v2/get-started/Use-case-specific-guides/vkyc-integration-guide)
- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model-2.1/)
- [GS1 Global Traceability Standard](https://www.gs1.org/docs/traceability/Global_Traceability_Standard.pdf)
- [GSMA IMEI Database services](https://www.gsma.com/get-involved/working-groups/terminal-steering-group/imei-database/)