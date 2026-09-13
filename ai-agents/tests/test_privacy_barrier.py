# SPDX-License-Identifier: MIT
"""Unit tests for the Strict Privacy Barrier and PrivacyGuard."""

import pytest
from shared.privacy_guard import PrivacyGuard, PrivacyLeakageException
from shared.schemas.product_schemas import PrivateVerificationInput, CategoryEnum


def test_sanitize_text_redacts_imei_and_private_paths():
    text = "Vendo iPhone imei 354892091234569 guardado en ayni-evidence-private/item1.jpg"
    sanitized = PrivacyGuard.sanitize_text(text)
    assert "354892091234569" not in sanitized
    assert "[IMEI_PROTEGIDO_POR_AYNI]" in sanitized
    assert "ayni-evidence-private" not in sanitized
    assert "[RUTA_PRIVADA_RESTRINGIDA]" in sanitized


def test_assert_zero_privacy_leakage_clean_payload():
    clean_dict = {
        "brand": "Apple",
        "model": "iPhone 13 Pro",
        "storage_gb": 128,
        "features": ["OLED", "5G", "MagSafe"]
    }
    # Should not raise
    PrivacyGuard.assert_zero_privacy_leakage(clean_dict)


def test_assert_zero_privacy_leakage_catches_forbidden_keys():
    forbidden_dict = {
        "brand": "Apple",
        "imei_number": "12345"
    }
    with pytest.raises(PrivacyLeakageException, match="Forbidden key detected"):
        PrivacyGuard.assert_zero_privacy_leakage(forbidden_dict)

    forbidden_serial_dict = {
        "brand": "Dell",
        "serial_number": "XYZ12345"
    }
    with pytest.raises(PrivacyLeakageException, match="Forbidden key detected"):
        PrivacyGuard.assert_zero_privacy_leakage(forbidden_serial_dict)


def test_assert_zero_privacy_leakage_catches_raw_imei_string():
    leaked_dict = {
        "brand": "Apple",
        "description": "Comprado en tienda, serial visible 354892091234569"
    }
    with pytest.raises(PrivacyLeakageException, match="Raw IMEI or hardware identifier detected"):
        PrivacyGuard.assert_zero_privacy_leakage(leaked_dict)


def test_assert_zero_privacy_leakage_catches_private_path():
    leaked_dict = {
        "photo": "https://minio.ayni.local/ayni-evidence-private/user42/screen.png"
    }
    with pytest.raises(PrivacyLeakageException, match="Private evidence storage path leaked"):
        PrivacyGuard.assert_zero_privacy_leakage(leaked_dict)


def test_extract_allowed_public_attributes_strips_private_fields():
    private_input = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand="Apple",
        model="iPhone 13 Pro",
        raw_description="iPhone 13 Pro 128GB sin detalles, imei 354892091234569",
        declared_condition=4,
        imei="354892091234569",
        serial_number="F2LLD094N6T4",
        photos_urls=["ayni-evidence-private/item1.jpg"],
        video_url="ayni-evidence-private/item1.mp4",
        storage_gb=128,
        ram_gb=6,
        battery_health_percentage=88,
        account_lock_status="unlocked"
    )

    public_attrs = PrivacyGuard.extract_allowed_public_attributes(
        private_input=private_input,
        cosmetic_notes="Pantalla en buen estado"
    )

    dumped = public_attrs.model_dump()
    assert "imei" not in dumped
    assert "serial_number" not in dumped
    assert "photos_urls" not in dumped
    assert "video_url" not in dumped
    assert dumped["brand"] == "Apple"
    assert dumped["model"] == "iPhone 13 Pro"
    assert dumped["storage_gb"] == 128
    assert dumped["battery_health"] == 88
    assert dumped["carrier_status"] == "Unlocked"
    assert dumped["is_verified"] is True
