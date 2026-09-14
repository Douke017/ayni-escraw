// SPDX-License-Identifier: MIT
const isBrowser = typeof window !== 'undefined';
const isDevServer = isBrowser && (window.location.port === '4200' || (window.location.hostname === 'localhost' && window.location.port !== '5000' && window.location.port !== ''));

export const environment = {
  production: true,
  apiBaseUrl: isDevServer ? 'http://localhost:5000/api' : (isBrowser ? `${window.location.origin}/api` : '/api'),
  signalrHubUrl: isDevServer ? 'http://localhost:5000' : (isBrowser ? window.location.origin : ''),
  minioStorageUrl: isDevServer ? 'http://localhost:9000' : (isBrowser ? window.location.origin : ''),
  chainId: 133,
  chainName: 'HSK Testnet',
  rpcUrl: 'https://testnet.hsk.xyz',
  blockExplorerUrl: 'https://testnet-explorer.hskchain.net',
  reownProjectId: 'b56e18d47c72ab683b10814fe9495694',
  contracts: {
    usdt: '0x69F391d998e9AbA14Cc9FA702be9Cf7b1D03d7f0',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    passport: '0x618197F71C3e6B79489763BA7DD2A3f0d19FB344',
    registry: '0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2',
    escrow: '0x03A5FE6351fB58C28CB5907752a46f8b13ffAD00',
    subscription: '0xBa8FD902f65DeF3153CbD609842CAfe3FD058c78',
    chatBond: '0x6023E014c95f080A5ebA00723e610C3bdbf0dC81',
  },
};
