# SPDX-License-Identifier: MIT
"""Smartphone category validation script executed via run_script tool."""

import re
from typing import Dict, Any, Tuple


def _luhn_checksum_valid(imei_str: str) -> bool:
    """Validates 15-digit IMEI using the Luhn algorithm."""
    if not imei_str or not imei_str.isdigit() or len(imei_str) != 15:
        return False
    digits = [int(d) for d in imei_str]
    checksum = 0
    for i in range(14):
        val = digits[i]
        if i % 2 == 1:
            val *= 2
            if val > 9:
                val -= 9
        checksum += val
    expected_check_digit = (10 - (checksum % 10)) % 10
    return digits[14] == expected_check_digit


def validate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates physical and diagnostic specs for a smartphone.
    
    Returns:
        dict: {
            "verdict": int (0=PASS, 1=WARN, 2=FAIL),
            "confidence_score": float,
            "flags": list[str],
            "rationale": str
        }
    """
    flags = []
    rationale_items = []
    verdict = 0 # PASS by default

    raw_description = (input_data.get("raw_description") or "").lower()
    account_lock = (input_data.get("account_lock_status") or "").lower()
    imei = input_data.get("imei")
    battery_health = input_data.get("battery_health_percentage")
    functional_tests = input_data.get("functional_tests") or {}

    # 1. Prohibited fraud terms
    fraud_patterns = ["saltar icloud", "bypass", "cuenta bloqueada", "clon", "imei cambiado", "liberacion temporal"]
    for pattern in fraud_patterns:
        if pattern in raw_description:
            flags.append(f"FRAUD_KEYWORD_DETECTED: {pattern}")
            rationale_items.append(f"Publicación contiene términos de fraude o bloqueo ('{pattern}')")
            verdict = 2 # FAIL

    # 2. Account Lock Status Check
    is_unlocked = any(clean in account_lock for clean in ["unlocked", "libre", "desbloqueado", "sin cuenta", "clean"])
    is_locked = any(lock in account_lock for lock in ["locked", "icloud", "frp", "bloqueado", "bloqueo", "cuenta activa"])
    if is_locked and not is_unlocked:
        flags.append("ACCOUNT_LOCK_ACTIVE")
        rationale_items.append("El equipo cuenta con bloqueo de cuenta o activación activo")
        verdict = 2 # FAIL
    elif is_unlocked:
        rationale_items.append("Dispositivo verificado sin bloqueos de cuenta")

    # 3. IMEI Validation
    if imei:
        clean_imei = re.sub(r"\D", "", str(imei))
        if len(clean_imei) != 15 or not _luhn_checksum_valid(clean_imei):
            flags.append("INVALID_IMEI_CHECKSUM")
            rationale_items.append("El IMEI provisto no cumple con el algoritmo de verificación Luhn")
            verdict = 2 # FAIL
        else:
            rationale_items.append("IMEI verificado con checksum Luhn válido")

    # 4. Battery Discrepancy Check
    if battery_health is not None:
        if ("100%" in raw_description or "nueva" in raw_description or "impecable" in raw_description) and battery_health < 80:
            flags.append(f"BATTERY_CLAIM_DISCREPANCY: Declared new/100% vs actual {battery_health}%")
            rationale_items.append(f"Discrepancia crítica: El vendedor declara batería como nueva pero el diagnóstico indica {battery_health}%")
            if verdict < 2:
                verdict = 1 # WARN
        elif battery_health < 70:
            flags.append(f"BATTERY_DEGRADED: {battery_health}%")
            rationale_items.append(f"Salud de batería degradada ({battery_health}%) requiere mantenimiento")
            if verdict < 1:
                verdict = 1 # WARN
        else:
            rationale_items.append(f"Salud de batería validada en {battery_health}%")

    # 5. Essential Hardware Functions Check
    critical_tests = ["screen_touch", "cameras", "cellular"]
    for test_name in critical_tests:
        if test_name in functional_tests and not functional_tests[test_name]:
            flags.append(f"HARDWARE_TEST_FAILED: {test_name}")
            rationale_items.append(f"Falla en prueba de hardware esencial: {test_name}")
            if verdict < 2:
                verdict = 2 # FAIL

    confidence = 0.96 if verdict == 0 else (0.90 if verdict == 1 else 0.99)
    rationale = "; ".join(rationale_items) if rationale_items else "Verificación técnica física satisfactoria"

    return {
        "verdict": verdict,
        "confidence_score": confidence,
        "flags": flags,
        "rationale": rationale
    }
