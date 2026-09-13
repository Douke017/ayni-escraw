# SPDX-License-Identifier: MIT
"""Meeting slot coordination script executed via scheduling_skill run_skill tool."""

from typing import Dict, Any
from shared.schemas.negotiation_schemas import NegotiationPolicy

SECURITY_DISCLAIMER = (
    "IMPORTANTE - PROTOCOLO DE SEGURIDAD AYNI: "
    "Este Agente de IA NO tiene autorización para confirmar la entrega física del producto "
    "ni para liberar fondos en el contrato inteligente AyniEscrow. "
    "La liberación de fondos se realiza ÚNICAMENTE mediante el escaneo presencial del "
    "código QR Safe Meet (2-of-2 multisig con nonce de 60s en Redis) o confirmación on-chain por las partes."
)


def execute(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Coordinates a Safe Meet or Video Verify slot within seller availability policy.
    
    Args:
        input_data: Dictionary containing:
            - handoff_preference: str ("SAFE_MEET" or "VIDEO_VERIFY")
            - requested_slot: str (e.g. "Martes 15:00")
            - requested_location: str
            - policy: Dict or NegotiationPolicy
            
    Returns:
        Structured appointment payload with security disclaimer.
    """
    handoff_pref = (input_data.get("handoff_preference") or "SAFE_MEET").strip().upper()
    requested_slot = (input_data.get("requested_slot") or "").strip()
    requested_location = (input_data.get("requested_location") or "").strip()
    raw_policy = input_data.get("policy") or {}

    policy = NegotiationPolicy(**raw_policy) if isinstance(raw_policy, dict) else raw_policy

    # Select and validate location
    chosen_location = requested_location
    is_preferred_location = True
    if policy.preferred_meet_locations:
        if requested_location not in policy.preferred_meet_locations:
            chosen_location = policy.preferred_meet_locations[0]
            is_preferred_location = False

    return {
        "status": "COORDINATED",
        "handoff_type": handoff_pref,
        "scheduled_slot": requested_slot or policy.available_handoff_hours[0] if policy.available_handoff_hours else "Por acordar",
        "meeting_location": chosen_location if handoff_pref == "SAFE_MEET" else "Enlace de Sala Privada Ayni Video Verify",
        "is_preferred_location": is_preferred_location,
        "allowed_hours": policy.available_handoff_hours,
        "allowed_locations": policy.preferred_meet_locations,
        "security_disclaimer": SECURITY_DISCLAIMER
    }
