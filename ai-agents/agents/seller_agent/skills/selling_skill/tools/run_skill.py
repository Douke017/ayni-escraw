# SPDX-License-Identifier: MIT
"""run_skill tool for selling_skill.

Dynamically dispatches commercial selling actions:
- GENERATE_LISTING
- NEGOTIATE_PRICE
- ANSWER_FAQ
"""

from typing import Dict, Any
from agents.seller_agent.skills.selling_skill.tools.scripts import (
    generate_listing_script,
    negotiate_price_script,
    answer_faq_script
)

SELLING_ACTIONS_REGISTRY = {
    "GENERATE_LISTING": generate_listing_script.execute,
    "NEGOTIATE_PRICE": negotiate_price_script.execute,
    "ANSWER_FAQ": answer_faq_script.execute,
}


def run_skill(action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a commercial selling task via the appropriate script.
    
    Args:
        action: The requested action ("GENERATE_LISTING", "NEGOTIATE_PRICE", "ANSWER_FAQ").
        payload: Input parameters for the script.
        
    Returns:
        Structured result dict.
    """
    action_upper = (action or "").strip().upper()
    handler = SELLING_ACTIONS_REGISTRY.get(action_upper)
    if not handler:
        raise ValueError(
            f"Acción desconocida en selling_skill: '{action}'. "
            f"Acciones permitidas: {list(SELLING_ACTIONS_REGISTRY.keys())}"
        )
    return handler(payload)
