# SPDX-License-Identifier: MIT
"""Unit tests for the Seller Agent listing generation, negotiation matrix, and meeting coordination."""

import pytest
from agents.seller_agent.seller_agent import SellerAgent
from agents.seller_agent.negotiation_rules import evaluate_buyer_offer
from shared.schemas.negotiation_schemas import (
    BuyerOffer,
    NegotiationPolicy,
    NegotiationAction
)
from shared.schemas.product_schemas import PublicTechnicalAttributes, CategoryEnum
from shared.schemas.attestation_schemas import AttestationResult, ValidationVerdict
from shared.privacy_guard import PrivacyGuard


@pytest.fixture
def policy():
    return NegotiationPolicy(
        list_price=250.0,
        min_acceptable_price=220.0,
        auto_accept_at_or_above=245.0,
        require_seller_approval=True,
        available_handoff_hours=["Lunes a Viernes 14:00 - 18:00"],
        preferred_meet_locations=["Centro Comercial Seguro - Plaza Norte"]
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
        rationale="Verificación técnica aprobada",
        request_hash="0x73f639e161f4b51a2be71d8bbef013effd6df47db5cb5985bebcc461c1a41ac4",
        validator_agent_id=42,
        timestamp=1700000000,
        version="1.0.0",
        expiry_timestamp=1700604800,
        allowed_public_attributes=public_specs
    )


# ---------------------------------------------------------
# NEGOTIATION STATE MATRIX TESTS (5 BANDS)
# ---------------------------------------------------------

def test_negotiation_band_1_full_price_accept(policy):
    offer = BuyerOffer(
        offer_id="off_1",
        buyer_address="0xBuyer1",
        offered_amount=250.0,
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy)
    assert decision.action == NegotiationAction.ACCEPT
    assert decision.negotiation_band == "FULL_PRICE_OR_ABOVE"
    assert not decision.requires_seller_approval


def test_negotiation_band_2_auto_accept(policy):
    offer = BuyerOffer(
        offer_id="off_2",
        buyer_address="0xBuyer2",
        offered_amount=247.0,
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy)
    assert decision.action == NegotiationAction.AUTO_ACCEPT
    assert decision.negotiation_band == "AUTO_ACCEPT_RANGE"
    assert not decision.requires_seller_approval


def test_negotiation_band_3_approval_required(policy):
    offer = BuyerOffer(
        offer_id="off_3",
        buyer_address="0xBuyer3",
        offered_amount=230.0,
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy)
    assert decision.action == NegotiationAction.REQUEST_SELLER_APPROVAL
    assert decision.requires_seller_approval is True
    assert decision.counter_offer_amount == 237.50  # midpoint between 230 and 245


def test_negotiation_band_3_direct_counter_offer():
    policy_no_approval = NegotiationPolicy(
        list_price=250.0,
        min_acceptable_price=220.0,
        auto_accept_at_or_above=245.0,
        require_seller_approval=False
    )
    offer = BuyerOffer(
        offer_id="off_3b",
        buyer_address="0xBuyer3b",
        offered_amount=230.0,
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy_no_approval)
    assert decision.action == NegotiationAction.COUNTER_OFFER
    assert decision.requires_seller_approval is False
    assert decision.counter_offer_amount == 237.50


def test_negotiation_band_4_below_floor_reject(policy):
    offer = BuyerOffer(
        offer_id="off_4",
        buyer_address="0xBuyer4",
        offered_amount=215.0,  # Below 220.0 floor
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy)
    assert decision.action == NegotiationAction.REJECT
    assert decision.negotiation_band == "BELOW_FLOOR_PRICE"
    assert decision.counter_offer_amount == 220.0


def test_negotiation_band_5_expired_offer(policy):
    offer = BuyerOffer(
        offer_id="off_5",
        buyer_address="0xBuyer5",
        offered_amount=250.0,
        created_at=1700000010,
        is_expired=True
    )
    decision = evaluate_buyer_offer(offer, policy)
    assert decision.action == NegotiationAction.INVALID_EXPIRED
    assert decision.negotiation_band == "EXPIRED"


# ---------------------------------------------------------
# LISTING GENERATION & GROUNDED FAQS
# ---------------------------------------------------------

def test_listing_generation_grounded_specs(public_specs, attestation):
    agent = SellerAgent()
    listing = agent.generate_listing(public_specs, attestation, seller_notes="Viene con cargador original")

    assert "Apple iPhone 13 Pro" in listing["title"]
    assert "Verificado Ayni" in listing["title"]
    assert len(listing["checklist"]) >= 4
    assert any("88%" in item for item in listing["checklist"])
    assert len(listing["faqs"]) >= 2
    assert "0x73f639e161f4b51a2be71d8bbef013effd6df47db5cb5985bebcc461c1a41ac4" in listing["description"]

    # Assert zero privacy leakage
    PrivacyGuard.assert_zero_privacy_leakage(listing)


# ---------------------------------------------------------
# MEETING COORDINATION & SECURITY BOUNDARY
# ---------------------------------------------------------

def test_coordinate_meeting_includes_security_disclaimer(policy):
    agent = SellerAgent()
    coord = agent.coordinate_meeting(
        handoff_preference="SAFE_MEET",
        requested_slot="Martes 15:00",
        requested_location="Centro Comercial Seguro - Plaza Norte",
        policy=policy
    )
    assert coord["handoff_type"] == "SAFE_MEET"
    assert coord["meeting_location"] == "Centro Comercial Seguro - Plaza Norte"
    assert "NO tiene autorización para confirmar la entrega física del producto" in coord["security_disclaimer"]
    assert "AyniEscrow" in coord["security_disclaimer"]


def test_coordinate_meeting_falls_back_to_preferred_location(policy):
    agent = SellerAgent()
    coord = agent.coordinate_meeting(
        handoff_preference="SAFE_MEET",
        requested_slot="Martes 15:00",
        requested_location="Callejón oscuro desconocido",
        policy=policy
    )
    assert coord["meeting_location"] == "Centro Comercial Seguro - Plaza Norte"


def test_seller_agent_convenience_functions(public_specs, attestation, policy):
    from agents.seller_agent.seller_agent import generate_listing, evaluate_offer
    listing = generate_listing(public_specs, attestation)
    assert "Apple iPhone 13 Pro" in listing["title"]

    offer = BuyerOffer(
        offer_id="off_conv",
        buyer_address="0xBuyer",
        offered_amount=250.0,
        created_at=1700000010
    )
    decision = evaluate_offer(offer, policy)
    assert decision.action == NegotiationAction.ACCEPT


def test_negotiation_default_auto_accept_threshold():
    policy_no_auto = NegotiationPolicy(
        list_price=300.0,
        min_acceptable_price=250.0,
        auto_accept_at_or_above=None  # defaults to list_price
    )
    offer = BuyerOffer(
        offer_id="off_def",
        buyer_address="0xBuyer",
        offered_amount=270.0,
        created_at=1700000010
    )
    decision = evaluate_buyer_offer(offer, policy_no_auto)
    assert decision.action == NegotiationAction.REQUEST_SELLER_APPROVAL

