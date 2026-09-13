# SPDX-License-Identifier: MIT
"""Laptop category validation script executed via run_script tool."""

from typing import Dict, Any


def validate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates physical and diagnostic specs for a laptop."""
    flags = []
    rationale_items = []
    verdict = 0

    raw_description = (input_data.get("raw_description") or "").lower()
    ram_gb = input_data.get("ram_gb")
    storage_gb = input_data.get("storage_gb")
    functional_tests = input_data.get("functional_tests") or {}

    # Prohibited lock terms
    if any(lock in raw_description for lock in ["bios lock", "computrace", "mdm", "firmware lock"]):
        flags.append("ENTERPRISE_FIRMWARE_LOCK")
        rationale_items.append("Bloqueo de firmware empresarial (MDM / Computrace / BIOS) detectado")
        verdict = 2

    # Hardware specs check
    if ram_gb is not None and ram_gb < 4:
        flags.append("SUBPAR_RAM")
        rationale_items.append("Capacidad de memoria RAM inferior a 4GB")
        if verdict < 1:
            verdict = 1

    # Hardware tests
    critical_tests = ["keyboard", "display", "ports"]
    for test_name in critical_tests:
        if test_name in functional_tests and not functional_tests[test_name]:
            flags.append(f"LAPTOP_HARDWARE_FAILED: {test_name}")
            rationale_items.append(f"Falla funcional detectada en {test_name}")
            if verdict < 2:
                verdict = 1

    confidence = 0.95 if verdict == 0 else 0.90
    rationale = "; ".join(rationale_items) if rationale_items else "Laptop con especificaciones físicas validadas"

    return {
        "verdict": verdict,
        "confidence_score": confidence,
        "flags": flags,
        "rationale": rationale
    }
