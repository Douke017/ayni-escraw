// SPDX-License-Identifier: MIT
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000/api',
  signalrHubUrl: 'http://localhost:5000',
  minioStorageUrl: 'http://localhost:9000',
  chainId: 133,
  chainName: 'HSK Testnet',
  rpcUrl: 'https://testnet.hsk.xyz',
  blockExplorerUrl: 'https://explorer.testnet.hsk.xyz',
  contracts: {
    usdt: '', // Set from USDT_TOKEN_ADDRESS in deployed-contracts.json
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    passport: '',
    registry: '',
    escrow: '',
    subscription: '',
    chatBond: '',
  },
};
