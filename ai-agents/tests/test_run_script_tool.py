# SPDX-License-Identifier: MIT
"""Unit tests for the run_script tool inside validate_product_skill."""

import pytest
from agents.product_verification_agent.skills.validate_product_skill.tools.run_script import run_script


def test_run_script_smartphone_valid():
    res = run_script("SMARTPHONE", {
        "raw_description": "Equipo libre sin cuentas",
        "account_lock_status": "unlocked",
        "imei": "354892091234569",
        "battery_health_percentage": 90,
        "functional_tests": {"screen_touch": True, "cameras": True, "cellular": True}
    })
    assert res["verdict"] == 0  # PASS
    assert res["confidence_score"] >= 0.90
    assert len(res["flags"]) == 0


def test_run_script_laptop_valid():
    res = run_script("LAPTOP", {
        "raw_description": "MacBook Air M1 impecable",
        "ram_gb": 16,
        "storage_gb": 512,
        "functional_tests": {"keyboard": True, "display": True, "ports": True}
    })
    assert res["verdict"] == 0  # PASS
    assert res["confidence_score"] >= 0.90


def test_run_script_component_valid():
    res = run_script("COMPONENT", {
        "raw_description": "RTX 3070 Ti usada solo para gaming casual",
        "declared_condition": 4
    })
    assert res["verdict"] == 0  # PASS


def test_run_script_unknown_category_warn():
    res = run_script("UNKNOWN_DEVICE", {
        "raw_description": "Cámara fotográfica antigua"
    })
    assert res["verdict"] == 1  # WARN
    assert "UNKNOWN_CATEGORY" in res["flags"][0]


def test_run_script_smartphone_degraded_battery_and_hardware_failure():
    res = run_script("SMARTPHONE", {
        "raw_description": "Equipo usado",
        "account_lock_status": "unlocked",
        "imei": "354892091234569",
        "battery_health_percentage": 65,  # degraded < 70%
        "functional_tests": {"screen_touch": True, "cellular": False}  # hardware failure
    })
    assert res["verdict"] == 2  # FAIL due to cellular failure
    assert any("HARDWARE_TEST_FAILED" in f for f in res["flags"])
    assert any("BATTERY_DEGRADED" in f for f in res["flags"])


def test_run_script_laptop_subpar_ram_and_keyboard_failure():
    res = run_script("LAPTOP", {
        "raw_description": "Laptop basica",
        "ram_gb": 2,  # Subpar RAM < 4GB
        "storage_gb": 64,
        "functional_tests": {"keyboard": False, "display": True, "ports": True}
    })
    assert res["verdict"] == 1  # WARN
    assert any("SUBPAR_RAM" in f for f in res["flags"])
    assert any("LAPTOP_HARDWARE_FAILED" in f for f in res["flags"])


def test_run_script_component_heavy_wear():
    res = run_script("COMPONENT", {
        "raw_description": "Placa de video con uso intenso",
        "declared_condition": 2  # condition < 3
    })
    assert res["verdict"] == 1  # WARN
    assert any("HEAVY_WEAR" in f for f in res["flags"])

