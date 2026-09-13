# SPDX-License-Identifier: MIT
"""Meeting location validation script executed via scheduling_skill run_skill tool."""

from typing import Dict, Any
from shared.schemas.negotiation_schemas import NegotiationPolicy


def execute(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates whether a proposed meeting location is safe and permitted.
    
    Args:
        input_data: Dictionary containing:
            - location: str
            - policy: Dict or NegotiationPolicy
            
    Returns:
        Dict with "is_valid", "location", "recommended_location", and "reason".
    """
    location = (input_data.get("location") or "").strip()
    raw_policy = input_data.get("policy") or {}
    policy = NegotiationPolicy(**raw_policy) if isinstance(raw_policy, dict) else raw_policy

    if not location:
        default_loc = policy.preferred_meet_locations[0] if policy.preferred_meet_locations else "Punto Seguro Autorizado Ayni"
        return {
            "is_valid": False,
            "location": "",
            "recommended_location": default_loc,
            "reason": "Debe especificar un punto de encuentro físico."
        }

    # Match case-insensitively against preferred locations
    matched = False
    for pref in policy.preferred_meet_locations:
        if pref.lower() in location.lower() or location.lower() in pref.lower():
            matched = True
            break

    if matched:
        return {
            "is_valid": True,
            "location": location,
            "recommended_location": location,
            "reason": "Ubicación verificada dentro de la lista de puntos autorizados del vendedor."
        }
    else:
        fallback = policy.preferred_meet_locations[0] if policy.preferred_meet_locations else "Centro Comercial Seguro"
        return {
            "is_valid": False,
            "location": location,
            "recommended_location": fallback,
            "reason": f"La ubicación '{location}' no es un punto de entrega autorizado. Se sugiere '{fallback}'."
        }
