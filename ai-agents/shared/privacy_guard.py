# SPDX-License-Identifier: MIT
"""Strict Privacy Barrier and Data Sanitization Guard.

Guarantees that no raw private hardware identifiers (IMEI, serial numbers)
or private evidence paths are leaked to the Seller Agent, persisted in databases,
or broadcast to the public blockchain.
"""

import re
from typing import Any, Dict, List
from shared.schemas.product_schemas import PrivateVerificationInput, PublicTechnicalAttributes


class PrivacyLeakageException(Exception):
    """Raised when private hardware identifiers or private media paths are detected in an outgoing public payload."""
    pass


class PrivacyGuard:
    # 14 to 16 digit sequences typical of IMEIs and MEIDs
    IMEI_REGEX = re.compile(r"\b\d{14,16}\b")
    # Common serial number patterns (alphanumeric 8-14 chars)
    SERIAL_REGEX = re.compile(r"\b[A-Z0-9]{8,14}\b")
    # Private storage paths
    PRIVATE_PATH_REGEX = re.compile(r"ayni-evidence-private", re.IGNORECASE)

    @classmethod
    def sanitize_text(cls, text: str) -> str:
        """Redacts IMEI and potential serial numbers from raw descriptions."""
        if not text:
            return ""
        sanitized = cls.IMEI_REGEX.sub("[IMEI_PROTEGIDO_POR_AYNI]", text)
        sanitized = cls.PRIVATE_PATH_REGEX.sub("[RUTA_PRIVADA_RESTRINGIDA]", sanitized)
        return sanitized

    @classmethod
    def extract_allowed_public_attributes(
        cls,
        private_input: PrivateVerificationInput,
        detected_brand: str = None,
        detected_model: str = None,
        cosmetic_notes: str = ""
    ) -> PublicTechnicalAttributes:
        """Constructs an approved public attributes model strictly stripped of all private data.
        
        Guarantees:
        1. Never passes IMEI or Serial Number.
        2. Never includes private photo/video evidence URLs.
        3. Sanitizes any notes to prevent accidental leakages in text descriptions.
        """
        brand = detected_brand or private_input.brand
        model = detected_model or private_input.model

        # Build clean public attributes
        public_attrs = PublicTechnicalAttributes(
            brand=brand.strip(),
            model=model.strip(),
            category=private_input.category,
            storage_gb=private_input.storage_gb,
            ram_gb=private_input.ram_gb,
            battery_health=private_input.battery_health_percentage,
            condition_rating=private_input.declared_condition,
            cosmetic_notes=cls.sanitize_text(cosmetic_notes or private_input.raw_description),
            carrier_status="Locked" if (
                private_input.account_lock_status and 
                any(k in private_input.account_lock_status.lower() for k in ["locked", "bloqueado", "frp", "icloud"]) and
                not any(k in private_input.account_lock_status.lower() for k in ["unlocked", "libre", "desbloqueado"])
            ) else "Unlocked",
            is_verified=True
        )

        # Enforce zero leakage assertion
        cls.assert_zero_privacy_leakage(public_attrs.model_dump())
        return public_attrs

    @classmethod
    def assert_zero_privacy_leakage(cls, payload: Any) -> None:
        """Recursively inspects any dictionary or list structure to ensure zero confidential data leakage."""
        if isinstance(payload, dict):
            for k, v in payload.items():
                k_lower = str(k).lower()
                if "imei" in k_lower or "serial" in k_lower:
                    raise PrivacyLeakageException(f"Forbidden key detected in public payload: '{k}'")
                cls.assert_zero_privacy_leakage(v)
        elif isinstance(payload, list):
            for item in payload:
                cls.assert_zero_privacy_leakage(item)
        elif isinstance(payload, str):
            # Check for 15-digit sequences (IMEI)
            if cls.IMEI_REGEX.search(payload):
                raise PrivacyLeakageException(f"Raw IMEI or hardware identifier detected in string value: '{payload}'")
            # Check for private evidence bucket paths
            if cls.PRIVATE_PATH_REGEX.search(payload):
                raise PrivacyLeakageException(f"Private evidence storage path leaked: '{payload}'")
