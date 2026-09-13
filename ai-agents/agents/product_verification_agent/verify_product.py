# SPDX-License-Identifier: MIT
"""Product Verification Agent - Core Verification Routine.

Validates declared hardware specs, physical condition, and diagnostic metrics
using the category-specific scripts via the `validate_product_skill` tool `run_script`.
Strictly filters out any private hardware identifiers (IMEI, serial numbers, private media URLs)
before producing an ERC-8004 compatible attestation and clean public specifications.
"""

import os
import sys
import json
import time
from typing import Dict, Any, Optional
from web3 import Web3

from shared.schemas.product_schemas import PrivateVerificationInput, PublicTechnicalAttributes
from shared.schemas.attestation_schemas import AttestationResult, ValidationVerdict
from shared.privacy_guard import PrivacyGuard, PrivacyLeakageException
from agents.product_verification_agent.config import ProductVerificationConfig, default_verification_config
from agents.product_verification_agent.skills.validate_product_skill.tools.run_script import run_script


class ProductVerificationAgent:
    """Modular AI Agent responsible for technical and fraud validation of second-hand hardware."""

    def __init__(self, config: Optional[ProductVerificationConfig] = None):
        self.config = config or default_verification_config

    def verify(self, private_input: PrivateVerificationInput) -> AttestationResult:
        """Executes full verification workflow:
        1. Dispatches category-specific verification rules via run_script tool.
        2. Evaluates multimodal media presence (minimum photos/video).
        3. Computes tamper-proof cryptographic requestHash commitment (bytes32).
        4. Strips all private data using PrivacyGuard.
        5. Emits certified AttestationResult conforming to ERC-8004 standards.
        """
        now = int(time.time())
        expiry = now + self.config.attestation_validity_seconds

        # 1. Execute category script via run_script tool
        script_output = run_script(
            category=private_input.category.value,
            input_data=private_input.model_dump()
        )

        verdict_val = script_output.get("verdict", 1)
        confidence = float(script_output.get("confidence_score", 0.90))
        flags = list(script_output.get("flags", []))
        rationale = script_output.get("rationale", "Verificación técnica completada")

        # 2. Multimodal media sanity checks
        if not private_input.photos_urls or len(private_input.photos_urls) < 2:
            flags.append("INSUFFICIENT_PHOTOS")
            if verdict_val < 1:
                verdict_val = 1  # Downgrade to WARN
            rationale += "; Se requieren al menos 2 fotografías claras del producto"

        # If confidence is below threshold and currently PASS, downgrade to WARN
        if confidence < self.config.min_pass_confidence and verdict_val == 0:
            verdict_val = 1
            flags.append("LOW_CONFIDENCE_WARNING")
            rationale += f"; Confianza del modelo ({confidence:.2f}) menor al umbral ({self.config.min_pass_confidence})"

        # 3. Compute cryptographic commitment (requestHash)
        # Commitment combines category, brand, model, timestamp, and validator ID
        commitment_seed = f"AYNI:{private_input.category}:{private_input.brand}:{private_input.model}:{now}:{self.config.agent_id}"
        request_hash_bytes = Web3.keccak(text=commitment_seed)
        request_hash = "0x" + request_hash_bytes.hex() if not request_hash_bytes.hex().startswith("0x") else request_hash_bytes.hex()

        # 4. Strict Privacy Barrier: Extract safe public attributes
        public_attributes = PrivacyGuard.extract_allowed_public_attributes(
            private_input=private_input,
            cosmetic_notes=rationale
        )

        verdict_enum = ValidationVerdict(verdict_val)

        attestation = AttestationResult(
            verdict=verdict_enum,
            confidence_score=confidence,
            flags=flags,
            rationale=rationale,
            request_hash=request_hash,
            validator_agent_id=self.config.agent_id,
            timestamp=now,
            version="1.0.0",
            expiry_timestamp=expiry,
            allowed_public_attributes=public_attributes
        )

        # 5. Formal zero leakage assertion check on the entire attestation
        PrivacyGuard.assert_zero_privacy_leakage(attestation.model_dump())

        return attestation


def verify_product(
    input_data: PrivateVerificationInput,
    config: Optional[ProductVerificationConfig] = None
) -> AttestationResult:
    """Convenience functional interface for product verification."""
    agent = ProductVerificationAgent(config=config)
    return agent.verify(input_data)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            raw = json.load(f)
        parsed_input = PrivateVerificationInput(**raw)
    else:
        # Default test payload for standalone CLI check
        parsed_input = PrivateVerificationInput(
            category="SMARTPHONE",
            brand="Apple",
            model="iPhone 13 Pro",
            raw_description="iPhone 13 Pro 128GB en excelente estado, bateria 88%, sin detalles ni bloqueos",
            declared_condition=4,
            imei="354892091234569",  # Synthetic test IMEI with valid Luhn checksum (9)
            photos_urls=["ayni-evidence-private/item1_front.jpg", "ayni-evidence-private/item1_back.jpg"],
            battery_health_percentage=88,
            storage_gb=128,
            ram_gb=6,
            account_lock_status="unlocked",
            functional_tests={"screen_touch": True, "cameras": True, "cellular": True}
        )

    result = verify_product(parsed_input)
    print(f"Verdict: {result.verdict.name} ({result.verdict.value})")
    print(f"Confidence: {result.confidence_score}")
    print(f"Request Hash: {result.request_hash}")
    print(f"Public Attributes: {result.allowed_public_attributes.model_dump_json(indent=2)}")
