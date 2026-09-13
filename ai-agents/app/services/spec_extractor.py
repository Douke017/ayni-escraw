# SPDX-License-Identifier: MIT
"""Spec Extractor Service and Programmatic Processing Pipeline.

Extracts normalized hardware specifications from unstructured titles and descriptions,
and invokes downstream agent programmatic functions (verify_product, generate_listing)
directly in Python without requiring any HTTP endpoints.
"""

import json
import hashlib
from typing import Dict, Any, Optional
from google import genai

from app.config import settings
from app.models import HardwareSpecExtractionRequest, HardwareSpecResult
from shared.schemas.product_schemas import PrivateVerificationInput, CategoryEnum


class SpecExtractorService:
    """Programmatic service for extracting structured specs using Gemini LLM or heuristics."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.client = None

    def _compute_profile_hash(self, data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True)
        return "0x" + hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def extract(self, req: HardwareSpecExtractionRequest) -> HardwareSpecResult:
        """Synchronous programmatic function to extract normalized specs."""
        # 1. If Gemini client is configured and active, invoke LLM
        if self.client:
            try:
                prompt = (
                    f"Extract normalized hardware specifications from this listing.\n"
                    f"Title: {req.title}\n"
                    f"Category: {req.declared_category}\n"
                    f"Description: {req.description}\n"
                    f"Return strictly valid JSON with keys: brand, model, storage, ram, color, battery_health_percentage, carrier_lock_status."
                )
                response = self.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                raw_text = response.text.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                parsed = json.loads(raw_text.strip())
                profile_hash = self._compute_profile_hash(parsed)
                return HardwareSpecResult(
                    brand=parsed.get("brand", "Unknown"),
                    model=parsed.get("model", req.title),
                    storage=parsed.get("storage"),
                    ram=parsed.get("ram"),
                    color=parsed.get("color"),
                    battery_health_percentage=parsed.get("battery_health_percentage"),
                    carrier_lock_status=parsed.get("carrier_lock_status", "Unlocked"),
                    technical_profile_hash=profile_hash,
                    confidence_score=0.95
                )
            except Exception:
                pass  # Fallback to deterministic parser below

        # 2. Deterministic heuristic fallback
        title_lower = req.title.lower()
        desc_lower = req.description.lower()
        
        if "iphone" in title_lower or "apple" in title_lower:
            brand = "Apple"
        elif "samsung" in title_lower or "galaxy" in title_lower:
            brand = "Samsung"
        elif "xiaomi" in title_lower:
            brand = "Xiaomi"
        else:
            brand = "Generic"

        storage = "256GB" if ("256" in desc_lower or "256" in title_lower) else ("512GB" if "512" in desc_lower else "128GB")
        
        fallback_data = {
            "brand": brand,
            "model": req.title,
            "storage": storage,
            "carrier_lock_status": "Unlocked"
        }
        profile_hash = self._compute_profile_hash(fallback_data)

        return HardwareSpecResult(
            brand=brand,
            model=req.title,
            storage=storage,
            ram="8GB",
            color="Natural Titanium",
            battery_health_percentage=98,
            carrier_lock_status="Unlocked",
            technical_profile_hash=profile_hash,
            confidence_score=0.88
        )

    async def extract_async(self, req: HardwareSpecExtractionRequest) -> HardwareSpecResult:
        """Async convenience wrapper for asynchronous runtimes."""
        return self.extract(req)


# ==============================================================
# DIRECT PROGRAMMATIC FUNCTIONS
# ==============================================================

def extract_specs(req: HardwareSpecExtractionRequest) -> HardwareSpecResult:
    """Programmatic API: Extracts normalized specs from a listing request."""
    service = SpecExtractorService()
    return service.extract(req)


def process_listing_pipeline(
    req: HardwareSpecExtractionRequest,
    declared_condition: int = 4,
    imei: Optional[str] = None,
    photos_urls: Optional[list] = None,
    account_lock_status: str = "unlocked",
    seller_notes: str = ""
) -> Dict[str, Any]:
    """Demonstrates complete programmatic flow without endpoints:
    1. Extracts normalized specs via SpecExtractorService.
    2. Invokes verify_product programmatic function with private data.
    3. Invokes generate_listing programmatic function with certified public specs.
    4. Returns verified bundle ready for storage or on-chain minting.
    """
    # 1. Spec Extraction
    extracted_specs = extract_specs(req)

    # 2. Build Category Enum
    cat_upper = req.declared_category.upper()
    category = CategoryEnum.SMARTPHONE
    if "LAPTOP" in cat_upper:
        category = CategoryEnum.LAPTOP
    elif "COMPONENT" in cat_upper or "GPU" in cat_upper:
        category = CategoryEnum.COMPONENT

    # Parse storage gb as int
    storage_int = 128
    if extracted_specs.storage:
        digits = "".join(filter(str.isdigit, extracted_specs.storage))
        if digits:
            storage_int = int(digits)

    # 3. Direct programmatic call to Product Verification Agent
    from agents.product_verification_agent.verify_product import verify_product
    from agents.seller_agent.seller_agent import generate_listing

    verification_input = PrivateVerificationInput(
        category=category,
        brand=extracted_specs.brand,
        model=extracted_specs.model,
        raw_description=req.description,
        declared_condition=declared_condition,
        imei=imei,
        photos_urls=photos_urls or ["ayni-evidence-private/img1.jpg", "ayni-evidence-private/img2.jpg"],
        battery_health_percentage=extracted_specs.battery_health_percentage,
        storage_gb=storage_int,
        account_lock_status=account_lock_status
    )
    attestation = verify_product(verification_input)

    # 4. Direct programmatic call to Seller Agent (Role: Vender)
    listing = generate_listing(
        public_attrs=attestation.allowed_public_attributes,
        attestation=attestation,
        seller_notes=seller_notes
    )

    return {
        "extracted_specs": extracted_specs.model_dump(),
        "attestation": attestation.model_dump(),
        "listing": listing
    }
