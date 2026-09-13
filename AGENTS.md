# Workspace Rules — Ayni Trust Marketplace

## 1. Context7 MCP Documentation Tooling

- **Auto-invoke Context7**: Whenever implementing code, verifying APIs, or configuring dependencies (e.g. Uniswap Permit2, OpenZeppelin v5, Viem, Angular 18 Signals, SignalR, Nethereum, Web3.py, MinIO), use Context7 tools (`resolve-library-id`, `query-docs`) to retrieve current, version-accurate documentation and code examples without guessing or hallucinating APIs.

## 2. Web3 & Solidity Standards (HSK Chain)

- **Solidity Version**: Strictly `pragma solidity ^0.8.24;`.
- **Framework**: Foundry (`forge`, `cast`, `anvil`) with `foundry.toml` optimized for EVM Cancun / HSK Chain.
- **Security Protocols**:
  - Checks-Effects-Interactions (CEI) in every state-mutating function.
  - OpenZeppelin v5 `ReentrancyGuard` (`nonReentrant`) on all fund/settlement entrypoints.
  - Uniswap Permit2 for single-signature off-chain EIP-712 token deposits (`depositWithPermit2`).
  - Privacy: Salted commitments `keccak256(abi.encodePacked(imei, salt, seller))` for IMEI / serial numbers. Never store hardware identifiers in plaintext on-chain.
  - ERC-8004 multi-registry implementation (Identity, Validation, Reputation).
- **Testing**: Complete coverage in `test/*.t.sol` including happy paths, unauthorized callers, fuzzing, and invariant tests before deployment.

## 3. Architecture Boundary Integrity

Follow [arquitectura.md](file:///home/douke017/Personal/Ayni-Scrow/arquitectura.md):
- **On-Chain**: `AyniEscrow.sol`, `AyniProductPassport.sol` (ERC-721), `AyniAgentRegistry.sol` (ERC-8004).
- **Off-Chain Backend**: ASP.NET Core (C#) with SignalR Hubs (`ChatHub`, `EscrowHub`, `InspectionHub`), EF Core on PostgreSQL 16, Redis 7 (TTL 60s nonces for Safe Meet QR), and internal MinIO.
- **Frontend**: Angular 18 with Vanilla Signals Services (`signal()`, `computed()`), no NgRx, direct synchronous mutations from SignalR and Viem.
- **AI Agent Service**: Python 3.11 with FastAPI and Web3.py for catalog specification extraction and ERC-8004 claim attestations.
