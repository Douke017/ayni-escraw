# SPDX-License-Identifier: MIT
"""Unit tests for the Web3 ERC-8004 Agent Client."""

import pytest
from shared.web3_client import Web3AgentClient


def test_web3_client_mock_record_validation():
    client = Web3AgentClient(mock_mode=True)
    res = client.record_validation_onchain(
        listing_id="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        agent_id=42,
        dictum=0,
        proof_hash="0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    )
    assert res["success"] is True
    assert res["mock"] is True
    assert res["tx_hash"].startswith("0x")
    assert res["agent_id"] == 42
    assert res["dictum"] == 0


def test_web3_client_mock_reputation_score():
    client = Web3AgentClient(mock_mode=True)
    score = client.get_reputation_score(agent_id=42)
    assert score == 100
