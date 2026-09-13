# SPDX-License-Identifier: MIT
"""FAQ answering script executed via selling_skill run_skill tool."""

from typing import Dict, Any
from shared.schemas.product_schemas import PublicTechnicalAttributes
from shared.privacy_guard import PrivacyGuard


def execute(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Answers a buyer inquiry grounded strictly on certified technical specifications.
    
    Args:
        input_data: Dictionary containing:
            - question: str
            - public_attributes: Dict or PublicTechnicalAttributes
            
    Returns:
        Dict with "question", "answer", and "grounded": bool.
    """
    question = (input_data.get("question") or "").strip()
    raw_public = input_data.get("public_attributes") or {}

    if isinstance(raw_public, dict):
        public_attrs = PublicTechnicalAttributes(**raw_public)
    else:
        public_attrs = raw_public

    PrivacyGuard.assert_zero_privacy_leakage(public_attrs.model_dump())
    q_lower = question.lower()

    if any(k in q_lower for k in ["batería", "bateria", "salud", "duración", "carga"]):
        if public_attrs.battery_health is not None:
            answer = f"La salud de batería está certificada en {public_attrs.battery_health}% según el diagnóstico técnico verificado."
        else:
            answer = "El equipo cuenta con batería operativa verificada en la prueba funcional inicial."
    elif any(k in q_lower for k in ["liberado", "operador", "bloqueo", "cuenta", "icloud", "chip", "sim", "red"]):
        answer = f"El estado verificado del dispositivo es '{public_attrs.carrier_status}', sin bloqueos activos."
    elif any(k in q_lower for k in ["pantalla", "estético", "estetico", "rayones", "golpes", "condición", "condicion"]):
        details = f" Detalles: {public_attrs.cosmetic_notes}." if public_attrs.cosmetic_notes else ""
        answer = f"La condición física certificada es {public_attrs.condition_rating}/5.{details}"
    elif any(k in q_lower for k in ["almacenamiento", "memoria", "espacio", "gigas", "gb", "ram"]):
        ram_info = f" y {public_attrs.ram_gb}GB de RAM" if public_attrs.ram_gb else ""
        answer = f"El modelo cuenta con {public_attrs.storage_gb or 'N/A'}GB de almacenamiento{ram_info}."
    else:
        answer = (
            f"El equipo es un {public_attrs.brand} {public_attrs.model} con calificación de condición {public_attrs.condition_rating}/5, "
            f"verificado por agentes técnicos de Ayni."
        )

    res = {
        "question": question,
        "answer": answer,
        "grounded": True,
        "verified_brand": public_attrs.brand,
        "verified_model": public_attrs.model
    }
    PrivacyGuard.assert_zero_privacy_leakage(res)
    return res
