#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
Programmatic Runner CLI for Ayni AI Agents.
Invoked directly by ASP.NET Core backend process execution (zero HTTP endpoints).
Reads JSON payload from stdin, executes the typed programmatic agent function,
and prints the JSON result to stdout.
"""

import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from agents.product_verification_agent.verify_product import verify_product
from agents.seller_agent.seller_agent import evaluate_offer, validate_meet_location
from app.services.spec_extractor import extract_specs
from app.models import HardwareSpecExtractionRequest
from shared.schemas.product_schemas import PrivateVerificationInput, CategoryEnum
from shared.schemas.negotiation_schemas import BuyerOffer, NegotiationPolicy

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command argument"}), file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    input_data = {}
    
    if not sys.stdin.isatty():
        raw_input = sys.stdin.read().strip()
        if raw_input:
            try:
                input_data = json.loads(raw_input)
            except Exception as e:
                print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}), file=sys.stderr)
                sys.exit(1)

    try:
        if command == "extract_specs":
            title = input_data.get("title", "")
            description = input_data.get("description", input_data.get("raw_text", ""))
            category = input_data.get("category", "SMARTPHONE")
            if not title:
                title = description[:50] if description else "Tech Product"
                
            req = HardwareSpecExtractionRequest(
                title=title,
                description=description,
                declared_category=category
            )
            result = extract_specs(req)
            output = {
                "success": True,
                "category": category,
                "attributes": result.model_dump(),
                "warnings": []
            }
            print(json.dumps(output))

        elif command == "validate_product":
            category_str = input_data.get("category", "SMARTPHONE").upper()
            category = CategoryEnum.SMARTPHONE
            if "LAPTOP" in category_str:
                category = CategoryEnum.LAPTOP
            elif "COMPONENT" in category_str or "GPU" in category_str:
                category = CategoryEnum.COMPONENT

            raw_description = input_data.get("listing_text", input_data.get("description", ""))
            checklist = input_data.get("checklist", {})
            brand = checklist.get("brand", "Apple")
            model = checklist.get("model", "iPhone 13")
            declared_condition = int(checklist.get("declared_condition", 4))
            imei = input_data.get("imei", checklist.get("imei"))
            battery_health = checklist.get("battery_health_percentage", 88)
            storage_gb = int(checklist.get("storage_gb", 128))
            account_lock = checklist.get("account_lock_status", "unlocked")
            photos = checklist.get("photos_urls", ["evidence/photo1.jpg", "evidence/photo2.jpg"])

            p_input = PrivateVerificationInput(
                category=category,
                brand=brand,
                model=model,
                raw_description=raw_description,
                declared_condition=declared_condition,
                imei=imei,
                photos_urls=photos,
                battery_health_percentage=battery_health,
                storage_gb=storage_gb,
                account_lock_status=account_lock
            )

            result = verify_product(p_input)
            output = {
                "verdict": result.verdict.value,
                "request_hash": result.request_hash,
                "discrepancies": result.flags,
                "summary": result.rationale,
                "timestamp": result.timestamp,
                "validator_agent_id": result.validator_agent_id,
                "public_attributes": result.allowed_public_attributes.model_dump()
            }
            print(json.dumps(output))

        elif command == "evaluate_offer":
            current_price = float(input_data.get("current_price", 250.0))
            offer_price = float(input_data.get("offer_price", 230.0))
            
            policy = NegotiationPolicy(
                list_price=current_price,
                min_acceptable_price=current_price * 0.85,
                auto_accept_at_or_above=current_price * 0.98
            )
            offer = BuyerOffer(
                offer_id="off_csharp",
                buyer_address=input_data.get("buyer_address", "0xBuyer"),
                offered_amount=offer_price,
                created_at=int(time.time())
            )

            decision = evaluate_offer(offer, policy)
            output = {
                "action": decision.action.value,
                "counter_price": decision.counter_offer_amount,
                "justification": decision.response_message,
                "price_band": decision.negotiation_band
            }
            print(json.dumps(output))

        elif command == "validate_meet_location":
            location_name = input_data.get("location_name", "Centro Comercial Seguro - Plaza Norte")
            policy = NegotiationPolicy(
                list_price=100.0,
                min_acceptable_price=80.0,
                auto_accept_at_or_above=95.0
            )

            res = validate_meet_location(location_name, policy)
            output = {
                "safety_score": 100.0 if res.get("location_approved") else 40.0,
                "safety_tier": "HIGH" if res.get("location_approved") else "LOW",
                "is_safe": res.get("location_approved", False),
                "approved": res.get("location_approved", False),
                "warnings": [res.get("warning")] if res.get("warning") else []
            }
            print(json.dumps(output))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}), file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
