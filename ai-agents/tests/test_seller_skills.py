# SPDX-License-Identifier: MIT
"""Unit tests for Seller Agent skills (selling_skill and scheduling_skill) via run_skill tools."""

import pytest
from agents.seller_agent.skills.selling_skill.tools.run_skill import run_skill as run_selling_skill
from agents.seller_agent.skills.scheduling_skill.tools.run_skill import run_skill as run_scheduling_skill
from shared.schemas.product_schemas import PublicTechnicalAttributes, CategoryEnum
from shared.schemas.attestation_schemas import AttestationResult, ValidationVerdict
from shared.schemas.negotiation_schemas import BuyerOffer, NegotiationPolicy
from agents import (
    generate_listing,
    evaluate_offer,
    answer_faq,
    schedule_meeting,
    validate_meet_location
)


@pytest.fixture
def public_specs():
    return PublicTechnicalAttributes(
        brand="Apple",
        model="iPhone 13 Pro",
        category=CategoryEnum.SMARTPHONE,
        storage_gb=128,
        ram_gb=6,
        battery_health=88,
        condition_rating=4,
        cosmetic_notes="Sin detalles cosméticos",
        carrier_status="Unlocked",
        is_verified=True
    )


@pytest.fixture
def attestation(public_specs):
    return AttestationResult(
        verdict=ValidationVerdict.PASS,
        confidence_score=0.96,
        flags=[],
        rationale="Verificación exitosa",
        request_hash="0x73f639e161f4b51a2be71d8bbef013effd6df47db5cb5985bebcc461c1a41ac4",
        validator_agent_id=42,
        timestamp=1700000000,
        version="1.0.0",
        expiry_timestamp=1700604800,
        allowed_public_attributes=public_specs
    )


@pytest.fixture
def policy():
    return NegotiationPolicy(
        list_price=250.0,
        min_acceptable_price=220.0,
        auto_accept_at_or_above=245.0,
        preferred_meet_locations=["Centro Comercial Seguro - Plaza Norte"]
    )


# ---------------------------------------------------------
# SELLING SKILL TESTS (via run_skill)
# ---------------------------------------------------------

def test_run_selling_skill_generate_listing(public_specs, attestation):
    payload = {
        "public_attributes": public_specs,
        "attestation": attestation,
        "seller_notes": "Cargador incluido"
    }
    result = run_selling_skill("GENERATE_LISTING", payload)
    assert "Apple iPhone 13 Pro" in result["title"]
    assert len(result["checklist"]) >= 4
    assert len(result["faqs"]) >= 2


def test_run_selling_skill_negotiate_price(policy):
    offer = BuyerOffer(
        offer_id="off_test_1",
        buyer_address="0xBuyer",
        offered_amount=248.0,
        created_at=1700000000
    )
    result = run_selling_skill("NEGOTIATE_PRICE", {"offer": offer, "policy": policy})
    assert result["action"] == "AUTO_ACCEPT"
    assert result["negotiation_band"] == "AUTO_ACCEPT_RANGE"


def test_run_selling_skill_answer_faq(public_specs):
    # Test battery question
    res_battery = run_selling_skill("ANSWER_FAQ", {
        "question": "¿Cómo está la batería del iPhone?",
        "public_attributes": public_specs
    })
    assert "88%" in res_battery["answer"]

    # Test carrier question
    res_carrier = run_selling_skill("ANSWER_FAQ", {
        "question": "¿Está liberado?",
        "public_attributes": public_specs
    })
    assert "Unlocked" in res_carrier["answer"]

    # Test storage question
    res_storage = run_selling_skill("ANSWER_FAQ", {
        "question": "¿Cuánta memoria tiene?",
        "public_attributes": public_specs
    })
    assert "128GB" in res_storage["answer"]

    # Test condition question
    res_cond = run_selling_skill("ANSWER_FAQ", {
        "question": "¿Qué tal la estética y rayones?",
        "public_attributes": public_specs
    })
    assert "4/5" in res_cond["answer"]


def test_run_selling_skill_unknown_action():
    with pytest.raises(ValueError, match="Acción desconocida en selling_skill"):
        run_selling_skill("FLY_TO_MOON", {})


# ---------------------------------------------------------
# SCHEDULING SKILL TESTS (via run_skill)
# ---------------------------------------------------------

def test_run_scheduling_skill_coordinate_slot_safe_meet(policy):
    payload = {
        "handoff_preference": "SAFE_MEET",
        "requested_slot": "Lunes 16:00",
        "requested_location": "Centro Comercial Seguro - Plaza Norte",
        "policy": policy
    }
    result = run_scheduling_skill("COORDINATE_SLOT", payload)
    assert result["status"] == "COORDINATED"
    assert result["handoff_type"] == "SAFE_MEET"
    assert result["meeting_location"] == "Centro Comercial Seguro - Plaza Norte"
    assert "NO tiene autorización para confirmar la entrega" in result["security_disclaimer"]


def test_run_scheduling_skill_coordinate_slot_video_verify(policy):
    payload = {
        "handoff_preference": "VIDEO_VERIFY",
        "requested_slot": "Lunes 18:00",
        "policy": policy
    }
    result = run_scheduling_skill("COORDINATE_SLOT", payload)
    assert result["handoff_type"] == "VIDEO_VERIFY"
    assert "Video Verify" in result["meeting_location"]


def test_run_scheduling_skill_validate_location(policy):
    # Valid location
    res_valid = run_scheduling_skill("VALIDATE_LOCATION", {
        "location": "Plaza Norte",
        "policy": policy
    })
    assert res_valid["is_valid"] is True

    # Invalid location
    res_invalid = run_scheduling_skill("VALIDATE_LOCATION", {
        "location": "Lugar solitario no autorizado",
        "policy": policy
    })
    assert res_invalid["is_valid"] is False
    assert res_invalid["recommended_location"] == "Centro Comercial Seguro - Plaza Norte"

    # Empty location
    res_empty = run_scheduling_skill("VALIDATE_LOCATION", {
        "location": "",
        "policy": policy
    })
    assert res_empty["is_valid"] is False


def test_run_scheduling_skill_unknown_action():
    with pytest.raises(ValueError, match="Acción desconocida en scheduling_skill"):
        run_scheduling_skill("UNKNOWN_ACTION", {})


# ---------------------------------------------------------
# DIRECT PROGRAMMATIC FUNCTION CALLS
# ---------------------------------------------------------

def test_direct_programmatic_apis(public_specs, attestation, policy):
    # 1. Programmatic listing
    listing = generate_listing(public_specs, attestation)
    assert "Apple iPhone 13 Pro" in listing["title"]

    # 2. Programmatic offer evaluation
    offer = BuyerOffer(
        offer_id="off_prog",
        buyer_address="0xBuyer",
        offered_amount=250.0,
        created_at=1700000000
    )
    decision = evaluate_offer(offer, policy)
    assert decision.action.value == "ACCEPT"

    # 3. Programmatic FAQ
    faq = answer_faq("¿La batería dura bien?", public_specs)
    assert "88%" in faq["answer"]

    # 4. Programmatic meeting schedule
    appt = schedule_meeting("SAFE_MEET", "Miércoles 11:00", "Plaza Norte", policy)
    assert appt["scheduled_slot"] == "Miércoles 11:00"

    # 5. Programmatic location validation
    loc_val = validate_meet_location("Plaza Norte", policy)
    assert loc_val["is_valid"] is True
