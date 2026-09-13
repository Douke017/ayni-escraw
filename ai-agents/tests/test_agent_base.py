# SPDX-License-Identifier: MIT
"""Unit tests for programmatic spec extraction and end-to-end processing pipeline."""

import pytest
from app.models import HardwareSpecExtractionRequest, HardwareSpecResult
from app.services.spec_extractor import (
    SpecExtractorService,
    extract_specs,
    process_listing_pipeline
)
from shared.schemas.attestation_schemas import ValidationVerdict


def test_programmatic_spec_extraction():
    req = HardwareSpecExtractionRequest(
        title="iPhone 15 Pro Max 256GB Natural Titanium",
        description="Mint condition, factory unlocked, 256GB SSD, battery 98%",
        declared_category="Smartphone"
    )
    result = extract_specs(req)
    assert isinstance(result, HardwareSpecResult)
    assert result.brand == "Apple"
    assert result.storage == "256GB"
    assert result.technical_profile_hash.startswith("0x")
    assert result.confidence_score >= 0.85


@pytest.mark.asyncio
async def test_programmatic_spec_extraction_async():
    service = SpecExtractorService()
    req = HardwareSpecExtractionRequest(
        title="Samsung Galaxy S24 Ultra 512GB",
        description="Excelente estado, 512GB, liberado",
        declared_category="Smartphone"
    )
    result = await service.extract_async(req)
    assert result.brand == "Samsung"
    assert result.storage == "512GB"


def test_programmatic_process_listing_pipeline():
    """Verifies that spec_extractor seamlessly invokes verify_product and generate_listing directly."""
    req = HardwareSpecExtractionRequest(
        title="iPhone 14 Pro 128GB",
        description="Excelente estado, bateria 90%, sin detalles",
        declared_category="Smartphone"
    )
    pipeline_result = process_listing_pipeline(
        req=req,
        declared_condition=4,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/p1.jpg", "ayni-evidence-private/p2.jpg"],
        account_lock_status="unlocked",
        seller_notes="Entrega personal"
    )

    assert "extracted_specs" in pipeline_result
    assert "attestation" in pipeline_result
    assert "listing" in pipeline_result

    # Check extracted specs
    assert pipeline_result["extracted_specs"]["brand"] == "Apple"

    # Check attestation result
    assert pipeline_result["attestation"]["verdict"] == ValidationVerdict.PASS
    assert pipeline_result["attestation"]["request_hash"].startswith("0x")

    # Check generated listing
    assert "Apple iPhone 14 Pro" in pipeline_result["listing"]["title"]
    assert len(pipeline_result["listing"]["checklist"]) >= 3
    assert len(pipeline_result["listing"]["faqs"]) >= 2
