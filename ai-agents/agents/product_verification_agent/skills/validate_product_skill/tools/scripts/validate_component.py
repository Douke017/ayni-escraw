# SPDX-License-Identifier: MIT
"""Component category validation script executed via run_script tool."""

from typing import Dict, Any


def validate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates physical and diagnostic specs for PC components/GPUs."""
    flags = []
    rationale_items = []
    verdict = 0

    raw_description = (input_data.get("raw_description") or "").lower()
    condition = input_data.get("declared_condition", 5)

    if any(k in raw_description for k in ["mineria 24/7", "quemado", "artifacts", "lineas en pantalla"]):
        flags.append("GPU_ARTIFACTS_DEGRADATION")
        rationale_items.append("Signos o declaraciones de artefactos visuales o fatiga térmica severa")
        verdict = 2
    elif condition < 3:
        flags.append("HEAVY_WEAR")
        rationale_items.append("Componente con desgaste físico pronunciado")
        verdict = 1

    confidence = 0.92
    rationale = "; ".join(rationale_items) if rationale_items else "Componente de hardware verificado correctamente"

    return {
        "verdict": verdict,
        "confidence_score": confidence,
        "flags": flags,
        "rationale": rationale
    }
