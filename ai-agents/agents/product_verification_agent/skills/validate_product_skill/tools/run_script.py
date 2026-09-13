# SPDX-License-Identifier: MIT
"""run_script tool for validate_product_skill.

Dynamically locates and executes category-specific validation scripts.
"""

from typing import Dict, Any
from agents.product_verification_agent.skills.validate_product_skill.tools.scripts import (
    validate_smartphone,
    validate_laptop,
    validate_component
)


SCRIPTS_REGISTRY = {
    "SMARTPHONE": validate_smartphone.validate,
    "LAPTOP": validate_laptop.validate,
    "COMPONENT": validate_component.validate
}


def run_script(category: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Tool that executes the appropriate validation script based on category.
    
    Args:
        category: The hardware category ('SMARTPHONE', 'LAPTOP', 'COMPONENT').
        input_data: The diagnostic and physical parameters dictionary.
        
    Returns:
        dict containing verdict, confidence_score, flags, and rationale.
    """
    category_upper = (category or "").upper()
    handler = SCRIPTS_REGISTRY.get(category_upper)
    if not handler:
        return {
            "verdict": 1, # WARN
            "confidence_score": 0.70,
            "flags": [f"UNKNOWN_CATEGORY: {category}"],
            "rationale": f"Categoría '{category}' no posee script de validación especializado; requiere revisión manual"
        }
    return handler(input_data)
