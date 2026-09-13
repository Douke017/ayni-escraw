# SPDX-License-Identifier: MIT
"""Ayni Autonomous AI Agents Suite.

Provides direct programmatic functions for second-hand electronics marketplace operations:
- Spec Extraction & Normalization: extract_specs, process_listing_pipeline
- Product Verification: verify_product
- Seller Agent (Vender): generate_listing, evaluate_offer, answer_faq
- Seller Agent (Agendar): schedule_meeting, coordinate_meeting, validate_meet_location
- Web3 ERC-8004 Attestation: record_validation_onchain
"""

from agents.product_verification_agent.verify_product import (
    ProductVerificationAgent,
    verify_product
)
from agents.seller_agent.seller_agent import (
    SellerAgent,
    generate_listing,
    evaluate_offer,
    answer_faq,
    schedule_meeting,
    coordinate_meeting,
    validate_meet_location
)
from app.services.spec_extractor import (
    SpecExtractorService,
    extract_specs,
    process_listing_pipeline
)
from shared.web3_client import default_web3_client

def record_validation_onchain(
    listing_id: str,
    agent_id: int,
    dictum: int,
    proof_hash: str
):
    """Programmatic API: Submits ERC-8004 attestation record to HSK Chain."""
    return default_web3_client.record_validation_onchain(
        listing_id=listing_id,
        agent_id=agent_id,
        dictum=dictum,
        proof_hash=proof_hash
    )

__all__ = [
    # Spec Extraction
    "SpecExtractorService",
    "extract_specs",
    "process_listing_pipeline",
    # Verification Agent
    "ProductVerificationAgent",
    "verify_product",
    # Seller Agent
    "SellerAgent",
    "generate_listing",
    "evaluate_offer",
    "answer_faq",
    "schedule_meeting",
    "coordinate_meeting",
    "validate_meet_location",
    # Web3 Attestation
    "record_validation_onchain",
]
