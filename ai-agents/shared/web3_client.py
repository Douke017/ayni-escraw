# SPDX-License-Identifier: MIT
"""Web3 Client for ERC-8004 AyniAgentRegistry on HSK Chain.

Enables the Product Verification Agent and Seller Agent to submit on-chain validation
attestations, query reputation scores, and verify agent identities.
"""

import os
import logging
from typing import Dict, Any, Optional
from web3 import Web3
from web3.exceptions import Web3Exception

logger = logging.getLogger(__name__)

# Minimal ABI for AyniAgentRegistry contract
AYNI_AGENT_REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "listingId", "type": "bytes32"},
            {"internalType": "uint256", "name": "agentId", "type": "uint256"},
            {"internalType": "uint8", "name": "dictum", "type": "uint8"},
            {"internalType": "bytes32", "name": "proofHash", "type": "bytes32"}
        ],
        "name": "recordValidation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "agentId", "type": "uint256"}],
        "name": "getReputationScore",
        "outputs": [{"internalType": "int256", "name": "", "type": "int256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "agentAddress", "type": "address"}],
        "name": "getAgentIdByAddress",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "listingId", "type": "bytes32"}],
        "name": "getValidation",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "listingId", "type": "bytes32"},
                    {"internalType": "uint256", "name": "agentId", "type": "uint256"},
                    {"internalType": "uint8", "name": "dictum", "type": "uint8"},
                    {"internalType": "bytes32", "name": "proofHash", "type": "bytes32"},
                    {"internalType": "uint256", "name": "validatedAt", "type": "uint256"}
                ],
                "internalType": "struct IAyniAgentRegistry.ValidationRecord",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


class Web3AgentClient:
    """Interface to submit ERC-8004 validation records to HSK Chain."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        registry_address: Optional[str] = None,
        private_key: Optional[str] = None,
        mock_mode: Optional[bool] = None
    ):
        self.rpc_url = rpc_url or os.getenv("HSK_RPC_URL", "https://subnets.avax.network/hashkey/testnet/rpc")
        self.registry_address = registry_address or os.getenv(
            "AGENT_REGISTRY_ADDRESS",
            "0x0000000000000000000000000000000000000000"
        )
        self.private_key = private_key or os.getenv("AGENT_PRIVATE_KEY", "")
        
        # Determine whether to run in offline / mock mode
        if mock_mode is not None:
            self.mock_mode = mock_mode
        else:
            self.mock_mode = (
                os.getenv("WEB3_MOCK_MODE", "true").lower() in ("true", "1", "yes")
                or not self.private_key
            )

        if not self.mock_mode:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if self.private_key:
                self.account = self.w3.eth.account.from_key(self.private_key)
                self.sender_address = self.account.address
            else:
                self.account = None
                self.sender_address = None

            if self.registry_address != "0x0000000000000000000000000000000000000000":
                self.contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(self.registry_address),
                    abi=AYNI_AGENT_REGISTRY_ABI
                )
            else:
                self.contract = None
        else:
            self.w3 = None
            self.account = None
            self.sender_address = "0x4242424242424242424242424242424242424242"
            self.contract = None

    def record_validation_onchain(
        self,
        listing_id: str,
        agent_id: int,
        dictum: int,
        proof_hash: str
    ) -> Dict[str, Any]:
        """Signs and broadcasts recordValidation transaction to AyniAgentRegistry on HSK Chain."""
        # Convert hex strings to bytes32 format
        listing_id_bytes = Web3.to_bytes(hexstr=listing_id) if isinstance(listing_id, str) and listing_id.startswith("0x") else Web3.keccak(text=str(listing_id))
        proof_hash_bytes = Web3.to_bytes(hexstr=proof_hash) if isinstance(proof_hash, str) and proof_hash.startswith("0x") else Web3.keccak(text=str(proof_hash))

        if self.mock_mode or not self.contract or not self.account:
            # Deterministic synthetic tx hash for test and mock environments
            synthetic_tx = Web3.keccak(text=f"MOCK_TX:{listing_id}:{agent_id}:{dictum}:{proof_hash}").hex()
            logger.info(f"[MOCK MODE] Validation recorded on-chain: tx={synthetic_tx}")
            return {
                "success": True,
                "tx_hash": "0x" + synthetic_tx if not synthetic_tx.startswith("0x") else synthetic_tx,
                "mock": True,
                "listing_id": listing_id,
                "agent_id": agent_id,
                "dictum": dictum
            }

        try:
            nonce = self.w3.eth.get_transaction_count(self.sender_address)
            gas_price = self.w3.eth.gas_price

            tx_data = self.contract.functions.recordValidation(
                listing_id_bytes,
                agent_id,
                dictum,
                proof_hash_bytes
            ).build_transaction({
                "from": self.sender_address,
                "nonce": nonce,
                "gasPrice": gas_price,
            })

            signed_tx = self.w3.eth.account.sign_transaction(tx_data, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            return {
                "success": receipt.status == 1,
                "tx_hash": tx_hash.hex(),
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "mock": False
            }
        except Web3Exception as e:
            logger.error(f"Web3 exception recording validation: {e}")
            return {
                "success": False,
                "error": str(e),
                "mock": False
            }

    def get_reputation_score(self, agent_id: int) -> int:
        """Reads cumulative reputation score from ERC-8004 registry."""
        if self.mock_mode or not self.contract:
            return 100  # Baseline score
        try:
            return self.contract.functions.getReputationScore(agent_id).call()
        except Exception as e:
            logger.warning(f"Error reading reputation score: {e}")
            return 100


default_web3_client = Web3AgentClient()
