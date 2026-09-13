# SPDX-License-Identifier: MIT
"""run_skill tool for scheduling_skill.

Dynamically dispatches scheduling and logistics actions:
- COORDINATE_SLOT
- VALIDATE_LOCATION
"""

from typing import Dict, Any
from agents.seller_agent.skills.scheduling_skill.tools.scripts import (
    coordinate_slot_script,
    validate_location_script
)

SCHEDULING_ACTIONS_REGISTRY = {
    "COORDINATE_SLOT": coordinate_slot_script.execute,
    "VALIDATE_LOCATION": validate_location_script.execute,
}


def run_skill(action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a scheduling/logistics task via the appropriate script.
    
    Args:
        action: The requested action ("COORDINATE_SLOT", "VALIDATE_LOCATION").
        payload: Input parameters for the script.
        
    Returns:
        Structured result dict.
    """
    action_upper = (action or "").strip().upper()
    handler = SCHEDULING_ACTIONS_REGISTRY.get(action_upper)
    if not handler:
        raise ValueError(
            f"Acción desconocida en scheduling_skill: '{action}'. "
            f"Acciones permitidas: {list(SCHEDULING_ACTIONS_REGISTRY.keys())}"
        )
    return handler(payload)
