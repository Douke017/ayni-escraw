# SPDX-License-Identifier: MIT
"""Unit tests for the Product Verification Agent."""

import pytest
from agents.product_verification_agent.verify_product import ProductVerificationAgent, verify_product
from shared.schemas.product_schemas import PrivateVerificationInput, CategoryEnum
from shared.schemas.attestation_schemas import ValidationVerdict
from shared.privacy_guard import PrivacyGuard


@pytest.fixture
def agent():
    return ProductVerificationAgent()


def test_verify_smartphone_pass(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 13 Pro",
        raw_description="iPhone 13 Pro 128GB en excelente estado, bateria 88%, sin detalles ni bloqueos",
        declared_condition=4,
        imei="354892091234569",  # Valid Luhn
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        battery_health_percentage=88,
        storage_gb=128,
        ram_gb=6,
        account_lock_status="unlocked",
        functional_tests={"screen_touch": True, "cameras": True, "cellular": True}
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.PASS
    assert result.confidence_score >= 0.90
    assert result.request_hash.startswith("0x")
    assert len(result.request_hash) == 66  # 32 bytes hex + '0x'
    assert result.allowed_public_attributes.carrier_status == "Unlocked"
    assert result.allowed_public_attributes.brand == "Apple"

    # Strict Privacy Barrier verification
    PrivacyGuard.assert_zero_privacy_leakage(result.model_dump())


def test_verify_smartphone_invalid_imei_luhn_fails(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Samsung",
        model="Galaxy S22",
        raw_description="Galaxy S22 en buen estado",
        declared_condition=3,
        imei="354892091234560",  # Invalid Luhn check digit
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        battery_health_percentage=85,
        account_lock_status="unlocked"
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.FAIL
    assert any("INVALID_IMEI_CHECKSUM" in f for f in result.flags)


def test_verify_smartphone_fraud_keyword_fails(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 14",
        raw_description="iPhone 14 listo para usar tras saltar icloud con bypass permanente",
        declared_condition=4,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        account_lock_status="unlocked"
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.FAIL
    assert any("FRAUD_KEYWORD_DETECTED" in f for f in result.flags)


def test_verify_smartphone_active_account_lock_fails(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Xiaomi",
        model="13 Pro",
        raw_description="Xiaomi 13 Pro, cuenta mi bloqueada",
        declared_condition=3,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        account_lock_status="iCloud / Mi Account locked"
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.FAIL
    assert "ACCOUNT_LOCK_ACTIVE" in result.flags


def test_verify_smartphone_battery_discrepancy_warns(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 12",
        raw_description="iPhone 12 bateria 100% nueva impecable",
        declared_condition=4,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        battery_health_percentage=74,  # Discrepancy: claimed 100% vs actual 74%
        account_lock_status="unlocked"
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.WARN
    assert any("BATTERY_CLAIM_DISCREPANCY" in f for f in result.flags)


def test_verify_insufficient_photos_downgrades_to_warn(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 13",
        raw_description="iPhone 13 libre",
        declared_condition=4,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/only_one_photo.jpg"],  # Only 1 photo
        battery_health_percentage=90,
        account_lock_status="unlocked"
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.WARN
    assert "INSUFFICIENT_PHOTOS" in result.flags


def test_verify_laptop_enterprise_lock_fails(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.LAPTOP,
        brand="Lenovo",
        model="ThinkPad T14",
        raw_description="ThinkPad empresarial con computrace y mdm activo",
        declared_condition=3,
        photos_urls=["ayni-evidence-private/front.jpg", "ayni-evidence-private/back.jpg"],
        ram_gb=16,
        storage_gb=512
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.FAIL
    assert "ENTERPRISE_FIRMWARE_LOCK" in result.flags


def test_verify_component_mining_wear_fails(agent):
    payload = PrivateVerificationInput(
        category=CategoryEnum.COMPONENT,
        brand="Nvidia",
        model="RTX 3080",
        raw_description="Usada en mineria 24/7, presenta lineas en pantalla a veces",
        declared_condition=2,
        photos_urls=["ayni-evidence-private/gpu1.jpg", "ayni-evidence-private/gpu2.jpg"]
    )
    result = agent.verify(payload)
    assert result.verdict == ValidationVerdict.FAIL
    assert "GPU_ARTIFACTS_DEGRADATION" in result.flags


def test_verify_product_convenience_function():
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 13 Pro",
        raw_description="Equipo libre",
        declared_condition=5,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/1.jpg", "ayni-evidence-private/2.jpg"],
        account_lock_status="unlocked"
    )
    res = verify_product(payload)
    assert res.verdict == ValidationVerdict.PASS


def test_verify_low_confidence_downgrade():
    from agents.product_verification_agent.config import ProductVerificationConfig
    custom_config = ProductVerificationConfig(min_pass_confidence=0.99)
    agent = ProductVerificationAgent(config=custom_config)
    payload = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 13",
        raw_description="Equipo libre",
        declared_condition=4,
        imei="354892091234569",
        photos_urls=["ayni-evidence-private/1.jpg", "ayni-evidence-private/2.jpg"],
        battery_health_percentage=85,
        account_lock_status="unlocked"
    )
    res = agent.verify(payload)
    assert res.verdict == ValidationVerdict.WARN
    assert "LOW_CONFIDENCE_WARNING" in res.flags


def test_private_verification_input_invalid_condition():
    with pytest.raises(ValueError):
        PrivateVerificationInput(
            category=CategoryEnum.SMARTPHONE,
            brand="Apple",
            model="iPhone 13",
            raw_description="Test",
            declared_condition=6  # invalid > 5
        )

