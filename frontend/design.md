# Ayni Escrow — Sistema de Diseño y Especificación de Frontend (Angular 22)

> Documento único de referencia para el diseño y arquitectura visual de **Ayni Escrow**, marketplace P2P no-custodial de tecnología y hardware sobre **HSK Chain**, con identidad andina (**aguayo**), autenticación Web3 (SIWE), pasaportes de producto ERC-721 y agentes autónomos bajo ERC-8004.
>
> Adaptado a un frontend **Angular 22** organizado en capas: `core` / `features` / `layouts` / `shared`, gobernado por **Vanilla Signals Services** nativos (sin NgRx ni `toSignal`), detección de cambios `OnPush` / Zoneless, y convención de nombres **BEM** en estilos `.scss` locales.

---

## 1. Identidad y Principios Rectores

Ayni (término quechua/aymara que expresa **reciprocidad y confianza mutua**) fusiona la riqueza artesanal del mercado andino tradicional con la seguridad criptográfica no-custodial de Web3. La identidad visual gira en torno al **aguayo**: la tela tejida de franjas y rombos vibrantes sobre fondos oscuros profundos y terrosos.

### Principios de Diseño:
- **Mobile-First Real**: Concebido para uso en campo (ej. escaneo de QR en Safe Meet en centros comerciales y plazas), escalando con solidez a tablet y desktop.
- **Cálido, Terroso y Tecnológico**: Fusión de colores andinos (chocolate profundo, terracota, ocre dorado, crema, oliva e índigo) con componentes fintech y Web3 de alta precisión (insignias criptográficas, temporizadores, bordes sutiles con resplandor dorado).
- **Redondeo Suave y Táctil**: Radio base de **8px** (`--radius-lg`) para inputs y controles, **12px / 16px** para tarjetas, y **9999px** (pill) para botones y chips de estado.
- **Elevación Sutil en Hover**: Elevación mediante el mixin `@include hover-lift` (-2px a -8px) con sombras teñidas con el color de marca.
- **Lenguaje Decorativo Aguayo**: Cintas de franjas (`aguayo-ribbon`), patrones textiles (`aguayo-pattern`), barras de detalle (`aguayo-stripe`) y acentos laterales (`aguayo-side-bar`) como firma identitaria.
- **Claridad de Estados Criptográficos**: Estados explícitos para transacciones on-chain, firmas off-chain (Permit2 / SIWE), atestaciones de IA (PASS, WARN, FAIL) y cuenta regresiva de 60s para Safe Meet.

---

## 2. Tipografía

**Familia Tipográfica Principal:** `Plus Jakarta Sans` (Google Fonts).

Import global en `src/styles/_typography.scss`:
```scss
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
```

Stack CSS aplicado en el `body`:
```scss
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

Pesos disponibles:
- **400** (Regular): Descripciones, inputs y texto secundario.
- **500** (Medium): Subtítulos, labels y cuerpo general.
- **600** (SemiBold): Encabezados de tarjetas, estados y botones.
- **700** (Bold): Títulos de sección, precios y números de bloque.
- **800** (ExtraBold): Headlines del hero principal y badges de confianza.

Escala tipográfica en `src/styles/_tokens.scss`:
| Token | Tamaño | Line-Height | Uso principal |
| :--- | :--- | :--- | :--- |
| `--text-xs` | 12px | 1.4 | Badges, hashes truncados (`0x12...34`), timestamps |
| `--text-sm` | 14px | 1.5 | Labels, notas técnicas, especificaciones de hardware |
| `--text-base` | 16px | 1.5 | Cuerpo de texto, botones, inputs |
| `--text-lg` | 18px | 1.4 | Títulos de tarjetas, subtítulos destacados |
| `--text-xl` | 20px | 1.3 | Precios en tarjetas, modales |
| `--text-2xl` | 24px | 1.25 | Títulos de sección mobile, precio en detalle |
| `--text-3xl` | 30px | 1.2 | Títulos de sección tablet / desktop |
| `--text-4xl` | 36px | 1.15 | Headlines de catálogo y banners |
| `--text-5xl` | 48px | 1.1 | Headline Hero en mobile/tablet |
| `--text-6xl` | 60px | 1.05 | Headline Hero en desktop |

---

## 3. Paleta de Colores y Tokens Semánticos

### 3.1 Tokens Base (`:root` en `src/styles/_tokens.scss`)
```scss
:root {
  /* Superficies y Fondos */
  --background: #F0E6D3;             /* Crema andino cálido */
  --foreground: #3D2B1F;             /* Chocolate profundo para texto principal */
  --card: #FFFBF5;                   /* Fondo de tarjetas limpias */
  --card-foreground: #3D2B1F;
  --popover: #FFFBF5;
  --popover-foreground: #3D2B1F;

  /* Acciones y Estados */
  --primary: #B54834;                /* Terracota andino para acción principal */
  --primary-hover: #8B3A3A;          /* Borgoña para hover */
  --primary-foreground: #FFFBF5;
  --secondary: #D4A055;              /* Ocre dorado para acción secundaria y acentos */
  --secondary-hover: #B8894A;
  --secondary-foreground: #3D2B1F;

  /* Estados Funcionales */
  --muted: #E8DCC8;                  /* Superficie tenue */
  --muted-foreground: #7A6555;       /* Texto atenuado */
  --accent: #8B6914;                 /* Oro oscuro */
  --accent-foreground: #FFFBF5;
  --destructive: #D4183D;            /* Error / Rechazo / FAIL */
  --destructive-foreground: #FFFFFF;
  --success: #2E7D32;                /* Éxito / Liquidado / PASS */
  --success-foreground: #FFFFFF;
  --warning: #ED6C02;                /* Alerta / WARN / Discrepancia */
  --warning-foreground: #FFFFFF;

  /* Bordes y Líneas */
  --border: rgba(61, 43, 31, 0.16);
  --border-focus: #D4A055;
  --input-background: #FFFBF5;
  --ring: #B54834;

  /* Paleta Firma Aguayo */
  --aguayo-deep: #3D2B1F;            /* Chocolate profundo (inmersión: navbar, hero, footer) */
  --aguayo-red: #C0583A;             /* Terracota */
  --aguayo-gold: #D4A055;            /* Ocre dorado */
  --aguayo-cream: #F0E6D3;           /* Crema */
  --aguayo-brown: #B8894A;           /* Marrón cálido */
  --aguayo-burgundy: #8B3A3A;        /* Borgoña */
  --aguayo-olive: #6B7A3D;           /* Oliva andino */
  --aguayo-indigo: #4A5478;          /* Índigo profundo */
}
```

### 3.2 Mapeo de Categorías de Hardware a Colores de Firma
Gestionado como constante tipada en `src/app/core/models/category.model.ts`:
| Categoría de Hardware | Color Aguayo | Token CSS |
| :--- | :--- | :--- |
| **Smartphones / Celulares** | Borgoña | `var(--aguayo-burgundy)` |
| **Laptops / Computadoras** | Oliva | `var(--aguayo-olive)` |
| **Componentes / GPUs** | Índigo | `var(--aguayo-indigo)` |
| **Consolas y Accesorios** | Ocre Dorado | `var(--aguayo-gold)` |
| **Ayni Pro / Verified** | Terracota | `var(--aguayo-red)` |

---

## 4. Radios, Sombras y Elevación

### 4.1 Radios de Borde
- `--radius-sm`: 4px (Chips pequeños, tags)
- `--radius-md`: 6px (Badges de estado)
- `--radius-lg`: 8px (Inputs, selects, textareas)
- `--radius-xl`: 12px (Tarjetas de producto, modales)
- `--radius-2xl`: 16px (Superficies contenedoras, panel de Safe Meet)
- `--radius-full`: 9999px (Pills, botones primarios, avatar/wallet chips)

### 4.2 Sombras y Resplandores (Glows)
- Sombra base suave: `0 2px 8px rgba(61, 43, 31, 0.08)`
- Sombra elevada: `0 8px 24px rgba(61, 43, 31, 0.14)`
- Resplandor primario: `--shadow-glow-red: 0 4px 16px rgba(192, 88, 58, 0.35)`
- Resplandor dorado: `--shadow-glow-gold: 0 4px 16px rgba(212, 160, 85, 0.40)`

---

## 5. Arquitectura de Carpetas y Buenas Prácticas (Angular 22)

Siguiendo estrictamente `.agents/skills/frontend-good-practices/SKILL.md`:

```text
frontend/src/app/
├── core/                           # Servicios singleton, estado transversal, Web3 y API
│   ├── guards/                     # wallet.guard.ts, seller.guard.ts
│   ├── interceptors/               # jwt.interceptor.ts, error.interceptor.ts
│   ├── models/                     # order.model.ts, listing.model.ts, passport.model.ts, chat.model.ts
│   ├── services/                   # Servicios con Vanilla Signals
│   │   ├── wallet-state.service.ts # Viem, dirección conectada, cambio de red HSK
│   │   ├── auth.service.ts         # Flujo SIWE, desafío nonce, JWT
│   │   ├── escrow-state.service.ts # Estado reactivo de órdenes, tiempos de inspección
│   │   ├── signalr.service.ts      # Conexiones ChatHub, EscrowHub, InspectionHub
│   │   ├── catalog.service.ts      # HTTP REST catálogo y Proof of Listing
│   │   └── chat-bond.service.ts    # Seguimiento de respuestas y bono 0.30 USDT
│   └── utils/                      # formatters.ts, crypto-hash.ts, luhn.ts
│
├── layouts/                        # Shell estructural cargado con Lazy Loading
│   └── main-layout/                # Topbar, Footer, Banner de Red HSK, router-outlet
│       ├── main-layout.component.ts
│       ├── main-layout.component.html
│       ├── main-layout.component.scss
│       └── components/
│           ├── topbar/             # Barra superior fija con botón de Wallet y Ayni Pro
│           └── footer/             # Pie de página con ribbon aguayo y copyright
│
├── features/                       # Flujos de negocio autocontenidos (Smart Components)
│   ├── home/                       # Landing page, categorías de puestos, hero inmersivo
│   ├── catalog/                    # Catálogo de hardware con filtros reactivos
│   │   ├── catalog-list/           # Grid responsivo de tarjetas de producto
│   │   └── product-detail/         # Detalle técnico, pasaporte ERC-721 y CTA de compra/chat
│   ├── listings/                   # Creación de publicaciones (Proof of Listing)
│   │   └── create-listing/         # Stepper guiado, desafío fotográfico y extracción IA
│   ├── escrow/                     # Transacciones de custodia no-custodial
│   │   ├── checkout/               # Firma Uniswap Permit2 con Viem
│   │   ├── safe-meet/              # Generador de QR 60s y escáner de cámara
│   │   └── video-verify/           # Sala de video 100ms y checklist en vivo
│   ├── chat/                       # Mensajería con Bono de Intención (0.30 USDT)
│   │   └── chat-room/              # Chat en tiempo real, contador 2/2 y negociación de IA
│   └── subscriptions/              # Membresía Ayni Pro Seller (6.99 USDT)
│
└── shared/                         # Componentes presentacionales Dumb / OnPush sin API
    ├── components/
    │   ├── aguayo-ribbon/          # Cinta de 6 franjas andinas
    │   ├── aguayo-pattern/         # Texturas textiles en gradiente/SVG
    │   ├── aguayo-stripe/          # Banda decorativa multicapa de producto
    │   ├── aguayo-side-bar/        # Barra lateral de colores para cards
    │   ├── badge/                  # Pill para estados (PASS, WARN, FAIL, FUNDED)
    │   ├── button/                 # Botón reusable BEM con variantes
    │   ├── card/                   # Tarjeta con hover-lift
    │   ├── countdown-timer/        # Temporizador circular/barra (60s Safe Meet, 24h Inspección)
    │   └── qr-code/                # Renderizador dinámico de código QR
    └── pipes/                      # UsdtPipe, TruncateAddressPipe, TimeAgoPipe
```

---

## 6. Componentes Decorativos Aguayo (`shared/components/`)

### 6.1 `aguayo-ribbon` (`ayni-aguayo-ribbon`)
Cinta horizontal de 6 franjas iguales:
`red (#C0583A) → gold (#D4A055) → olive (#6B7A3D) → indigo (#4A5478) → burgundy (#8B3A3A) → brown (#B8894A)`.
- Clases BEM: `.aguayo-ribbon`, `.aguayo-ribbon__stripe`, `.aguayo-ribbon--sm`, `.aguayo-ribbon--md`, `.aguayo-ribbon--rounded`.
- Ubicación: Bajo la topbar, en cabeceras de sección, en tarjetas destacadas.

### 6.2 `aguayo-pattern` (`ayni-aguayo-pattern`)
Textura textil de fondo para inmersión cultural andina.
- Variante `--vibrant`: Rombos sutiles en gradiente rojo/oro con opacidad muy baja (0.03 - 0.05).
- Variante `--detailed`: Trama geométrica más densa (rombos, círculos y bandas) para banners oscuros con opacidad 0.15 - 0.25.

### 6.3 `aguayo-stripe` (`ayni-aguayo-stripe`)
Separador decorativo multicapa utilizado en el detalle de producto, pasaporte digital y paneles de inspección.

### 6.4 `aguayo-side-bar` (`ayni-aguayo-side-bar`)
Franja vertical de acento en el borde izquierdo de tarjetas de categoría y formularios guiados. El color se recibe vía `input()` vinculado a la categoría del hardware.

---

## 7. Especificación por Pantalla y Flujos de Usuario

### 7.1 Layout Principal (`layouts/main-layout/`)
- **Topbar**:
  - Fondo `aguayo-deep` translúcido (95%) con `backdrop-filter: blur(12px)`.
  - Altura: 72px (mobile) / 80px (desktop).
  - Borde inferior con `aguayo-ribbon` (tamaño `xs`).
  - Logo Ayni con tipografía `Plus Jakarta Sans` en `aguayo-cream`.
  - Navegación: Catálogo, Publicar (+Proof of Listing), Mis Órdenes, Ayni Pro.
  - **Botón de Wallet Web3**:
    - Desconectado: Botón pill en `aguayo-red` con hover `aguayo-burgundy`: "Conectar Wallet".
    - Conectado: Chip con dot verde pulsante, red "HSK Testnet", saldo en USDT y dirección truncada (`0x1a...4f`). Al hacer clic, abre menú desplegable para desconectar o ver órdenes.
- **Footer**:
  - Fondo `aguayo-deep` con patrón aguayo atenuado.
  - Enlaces a documentación de contratos en HSK Chain, explorador de bloques y términos de no-custodia.
  - Ribbon aguayo redondeado (`aguayo-ribbon--rounded`) sobre el copyright.

### 7.2 Home (`features/home/`)
- **Hero**:
  - Fondo `aguayo-deep` con imagen de fondo atenuada y patrón andino.
  - Badge pill: "🛡️ Marketplace P2P con Escrow Descentralizado en HSK Chain".
  - Titular principal con span en gradiente oro/terracota: "Comercio de Tecnología Seguro, Transparente y Recíproco".
  - CTAs principales:
    - Primario: "Explorar Dispositivos Verificados" (pill terracota con resplandor).
    - Secundario: "Vender con Pasaporte Digital" (pill outline dorado).
- **Puestos de Categorías de Hardware**:
  - Grid de tarjetas de 1 (mobile) → 2 (tablet) → 4 (desktop) columnas.
  - Cada tarjeta presenta una barra lateral `aguayo-side-bar` con el color de la categoría (Smartphones = Borgoña, Laptops = Oliva, GPUs = Índigo, Consolas = Ocre).
  - Icono vectorial del dispositivo, conteo de equipos publicados y flecha interactiva con hover-lift.
- **Carrusel de Dispositivos Recientes / Más Verificados**:
  - Tarjetas de hardware con foto real, badge ERC-8004 PASS (escudo verde), precio en **USDT**, salud de batería y almacenamiento.

### 7.3 Catálogo de Hardware (`features/catalog/`)
- **Barra de Filtros Reactiva (Signals)**:
  - Pills de categoría sticky con dot del color aguayo correspondiente.
  - Filtro por rango de precio USDT, condición física (1 a 5 estrellas), y switch "Solo Verificados con Pasaporte ERC-721".
- **Tarjeta de Producto (Listing Card)**:
  - Imagen en proporción 4:3 con insignia de estado en esquina superior izquierda.
  - Badge ERC-8004:
    - **PASS** (Verde): Checklist 100% verificado por IA.
    - **WARN** (Naranja): Discrepancia menor declarada (ej. batería 78%).
  - Atributos clave: Chips de "128GB", "88% Batería", "Desbloqueado".
  - Precio destacado en `USDT` (negrita en ocre dorado).
  - Efecto `@include hover-lift` (-4px) con borde dorado al 40%.

### 7.4 Detalle de Producto y Pasaporte Digital (`features/catalog/product-detail/`)
- **Galería de Evidencia**: Carrusel de fotos públicas verificadas.
- **Sello del Pasaporte Digital (`AyniProductPassport`)**:
  - Token ID ERC-721 en HSK Chain.
  - Hash de compromiso salado visible: `keccak256(imei, salt, seller)` (garantía de privacidad: IMEI nunca en texto plano).
  - Enlace directo al explorador de HSK Chain.
- **Ficha Técnica Extraída por IA**:
  - Tabla limpia con especificaciones normalizadas por Gemini / SpecExtractor (Marca, Modelo, Batería, Almacenamiento, Estado de bloqueo).
- **Acciones de Compra y Negociación**:
  - Botón Primario: "Comprar en Escrow (USDT)" (Inicia depósito con Permit2).
  - Botón Secundario: "Negociar con Asistente del Vendedor" (Abre chat con AI Seller Agent).
  - Botón de Enlace: "Coordinar Video Verify o Safe Meet".

### 7.5 Creación de Publicación con Proof of Listing (`features/listings/create-listing/`)
- **Stepper Guiado (3 Pasos)**:
  1. **Datos del Dispositivo**: Título, categoría, precio en USDT, descripción informal o notas de voz (procesadas por IA).
  2. **Desafío Fotográfico Proof of Listing (POL)**:
     - El backend genera un código alfanumérico único con TTL de 10 minutos (ej. `AYNI-7X29`).
     - El vendedor escribe el código en un papel físico y toma la foto junto a la pantalla encendida del equipo.
     - Subida directa a MinIO mediante URL PUT prefirmada (`ayni-proof-of-listing`).
  3. **Verificación de Hardware y Atestación**:
     - Ingreso de IMEI o número de serie bajo sal criptográfica para calcular el commitment off-chain.
     - Extracción y validación automática por los agentes de IA.
     - Emisión y firma de acuñación del Pasaporte Digital ERC-721 en HSK Chain.

### 7.6 Chat Seguro y Negociación Inteligente (`features/chat/`)
- **Bono de Intención (0.30 USDT)**:
  - Banner en cabecera del chat informando el estado del bono `AyniChatBond`.
  - Contador de mensajes mutuos: `Progreso para reembolso: 1/2 respuestas del comprador, 1/2 respuestas del vendedor`.
  - Al alcanzar 2 respuestas cada uno, badge verde: `Reembolso del 100% (0.30 USDT) habilitado`.
- **Negociador Autónomo del Vendedor**:
  - Si el comprador envía una oferta económica, el AI Seller Agent evalúa la oferta en tiempo real contra las 5 bandas de precio y responde con contraoferta fundamentada o aceptación automática.
- **Mensajería en Tiempo Real**: WebSocket bidireccional gobernado por SignalR `ChatHub`.

### 7.7 Escrow, Safe Meet y Video Verify (`features/escrow/`)
- **Checkout Escrow (Permit2)**:
  - Resumen del monto en USDT y fee de plataforma (1%).
  - Autorización y depósito en una sola transacción mediante firma EIP-712 de Permit2 con Viem (`depositWithPermit2`).
- **Entrega Presencial Safe Meet (`safe-meet`)**:
  - **Modo Vendedor**: Genera el código QR dinámico con un secreto criptográfico de 32 bytes y un **temporizador circular regresivo de 60 segundos** (`SET handoff:{orderId}:nonce <secret> EX 60`).
  - **Modo Comprador**: Activa la cámara del smartphone para escanear el QR del vendedor.
  - Al validar, SignalR emite `HandoffQrScanned(true)`, el nonce es destruido en Redis (anti-replay), y la orden pasa inmediatamente a `HandoffConfirmed`, abriendo la ventana de inspección de 24 horas.
- **Sala Video Verify (`video-verify`)**:
  - Videollamada P2P efímera integrada con el SDK de 100ms.
  - Panel lateral interactivo con el checklist de diagnóstico físico sincronizado en vivo vía `InspectionHub`.

---

## 8. Convención de Estilos (BEM y SCSS Modular)

- Cada componente cuenta con su archivo `.component.scss` local.
- No se definen clases de utilidad atómicas en línea tipo Tailwind.
- Convención estricta:
```scss
.bloque {
  /* Propiedades del bloque */

  &__elemento {
    /* Propiedades del elemento hijo directo */
  }

  &--modificador {
    /* Variantes de estado o color */
  }
}
```
- Breakpoints consumidos desde `src/styles/_mixins.scss`:
  - `@include sm` (≥640px)
  - `@include md` (≥768px, Tablet)
  - `@include lg` (≥1024px, Desktop)
  - `@include xl` (≥1280px)

---

## 9. Criterios de Calidad y No-Negociables
1. **Zoneless & OnPush**: Todos los componentes declararán `changeDetection: ChangeDetectionStrategy.OnPush`.
2. **Vanilla Signals Services**: Ningún uso de NgRx, ni `toSignal` ni almacenes heredados. El estado es administrado mediante `signal()` y `computed()`.
3. **Cero Fugas de Identificadores**: Ningún IMEI o serial se renderiza en la UI pública sin saltear ni encriptar.
4. **Respaldo No-Custodial**: Ni el frontend ni el backend custodian fondos; toda transacción requiere la firma explícita de la wallet del usuario en HSK Chain.