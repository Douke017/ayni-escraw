# SPDX-License-Identifier: MIT
"""Ayni Seller Agent - Commercial Selling and Scheduling Programmatic Agent.

Encapsulates 2 distinct functional roles:
1. Vender (Selling Role): Generates certified listings, grounded FAQs, and executes autonomous price negotiations.
   Driven by the `selling_skill` via its `run_skill` tool.
2. Agendar (Scheduling Role): Coordinates Safe Meet and Video Verify handoff appointments.
   Driven by the `scheduling_skill` via its `run_skill` tool.

All capabilities are exposed as direct programmatic functions callable throughout the application.
"""

import sys
import json
from typing import Dict, Any, List, Optional

from shared.schemas.product_schemas import PublicTechnicalAttributes
from shared.schemas.attestation_schemas import AttestationResult
from shared.schemas.negotiation_schemas import (
    BuyerOffer,
    NegotiationPolicy,
    NegotiationDecision
)
from shared.privacy_guard import PrivacyGuard
from agents.seller_agent.config import SellerAgentConfig, default_seller_config
from agents.seller_agent.skills.selling_skill.tools.run_skill import run_skill as run_selling_skill
from agents.seller_agent.skills.scheduling_skill.tools.run_skill import run_skill as run_scheduling_skill


class SellerAgent:
    """Autonomous representative for the seller on Ayni Trust Marketplace."""

    def __init__(self, config: Optional[SellerAgentConfig] = None):
        self.config = config or default_seller_config

    # ==========================================================
    # ROL 1: VENDER (Selling Role)
    # ==========================================================

    def generate_listing(
        self,
        public_attrs: PublicTechnicalAttributes,
        attestation: AttestationResult,
        seller_notes: str = ""
    ) -> Dict[str, Any]:
        """Generates an attractive, fully certified marketplace listing.
        
        Executes via selling_skill (action GENERATE_LISTING).
        Strictly grounds all text, specs, and FAQs on certified public attributes.
        """
        payload = {
            "public_attributes": public_attrs,
            "attestation": attestation,
            "seller_notes": seller_notes
        }
        return run_selling_skill("GENERATE_LISTING", payload)

    def evaluate_offer(self, offer: BuyerOffer, policy: NegotiationPolicy) -> NegotiationDecision:
        """Evaluates incoming buyer offer against the seller's 5-band negotiation policy.
        
        Executes via selling_skill (action NEGOTIATE_PRICE).
        """
        payload = {
            "offer": offer,
            "policy": policy
        }
        decision_dict = run_selling_skill("NEGOTIATE_PRICE", payload)
        return NegotiationDecision(**decision_dict)

    def answer_faq(self, question: str, public_attrs: PublicTechnicalAttributes) -> Dict[str, Any]:
        """Answers a prospective buyer question strictly grounded on verified attributes.
        
        Executes via selling_skill (action ANSWER_FAQ).
        """
        payload = {
            "question": question,
            "public_attributes": public_attrs
        }
        return run_selling_skill("ANSWER_FAQ", payload)

    # ==========================================================
    # ROL 2: AGENDAR (Scheduling Role)
    # ==========================================================

    def schedule_meeting(
        self,
        handoff_preference: str,
        requested_slot: str,
        requested_location: str,
        policy: NegotiationPolicy
    ) -> Dict[str, Any]:
        """Coordinates Safe Meet or Video Verify handoff slots within approved seller policies.
        
        Executes via scheduling_skill (action COORDINATE_SLOT).
        Mandates the non-custodial delivery security disclaimer.
        """
        payload = {
            "handoff_preference": handoff_preference,
            "requested_slot": requested_slot,
            "requested_location": requested_location,
            "policy": policy
        }
        return run_scheduling_skill("COORDINATE_SLOT", payload)

    def coordinate_meeting(
        self,
        handoff_preference: str,
        requested_slot: str,
        requested_location: str,
        policy: NegotiationPolicy
    ) -> Dict[str, Any]:
        """Alias for schedule_meeting for backward compatibility."""
        return self.schedule_meeting(handoff_preference, requested_slot, requested_location, policy)

    def validate_location(self, location: str, policy: NegotiationPolicy) -> Dict[str, Any]:
        """Validates whether a proposed meeting location is safe and authorized.
        
        Executes via scheduling_skill (action VALIDATE_LOCATION).
        """
        payload = {
            "location": location,
            "policy": policy
        }
        return run_scheduling_skill("VALIDATE_LOCATION", payload)


# ==============================================================
# DIRECT PROGRAMMATIC FUNCTIONS (APIs directas para la app)
# ==============================================================

def generate_listing(
    public_attrs: PublicTechnicalAttributes,
    attestation: AttestationResult,
    seller_notes: str = "",
    config: Optional[SellerAgentConfig] = None
) -> Dict[str, Any]:
    """Programmatic API: Generates certified marketplace listing."""
    agent = SellerAgent(config=config)
    return agent.generate_listing(public_attrs, attestation, seller_notes)


def evaluate_offer(
    offer: BuyerOffer,
    policy: NegotiationPolicy,
    config: Optional[SellerAgentConfig] = None
) -> NegotiationDecision:
    """Programmatic API: Evaluates buyer offer across 5 pricing bands."""
    agent = SellerAgent(config=config)
    return agent.evaluate_offer(offer, policy)


def answer_faq(
    question: str,
    public_attrs: PublicTechnicalAttributes,
    config: Optional[SellerAgentConfig] = None
) -> Dict[str, Any]:
    """Programmatic API: Resolves buyer inquiry based on verified specs."""
    agent = SellerAgent(config=config)
    return agent.answer_faq(question, public_attrs)


def schedule_meeting(
    handoff_preference: str,
    requested_slot: str,
    requested_location: str,
    policy: NegotiationPolicy,
    config: Optional[SellerAgentConfig] = None
) -> Dict[str, Any]:
    """Programmatic API: Coordinates Safe Meet / Video Verify appointment."""
    agent = SellerAgent(config=config)
    return agent.schedule_meeting(handoff_preference, requested_slot, requested_location, policy)


def coordinate_meeting(
    handoff_preference: str,
    requested_slot: str,
    requested_location: str,
    policy: NegotiationPolicy,
    config: Optional[SellerAgentConfig] = None
) -> Dict[str, Any]:
    """Programmatic API: Alias for schedule_meeting."""
    return schedule_meeting(handoff_preference, requested_slot, requested_location, policy, config=config)


def validate_meet_location(
    location: str,
    policy: NegotiationPolicy,
    config: Optional[SellerAgentConfig] = None
) -> Dict[str, Any]:
    """Programmatic API: Validates meeting location against preferred safety list."""
    agent = SellerAgent(config=config)
    return agent.validate_location(location, policy)


if __name__ == "__main__":
    from shared.schemas.attestation_schemas import ValidationVerdict

    sample_public = PublicTechnicalAttributes(
        brand="Apple",
        model="iPhone 13 Pro",
        category="SMARTPHONE",
        storage_gb=128,
        ram_gb=6,
        battery_health=88,
        condition_rating=4,
        cosmetic_notes="Micro rayones en bisel, pantalla impecable",
        carrier_status="Unlocked",
        is_verified=True
    )
    sample_attestation = AttestationResult(
        verdict=ValidationVerdict.PASS,
        confidence_score=0.96,
        flags=[],
        rationale="Verificación exitosa",
        request_hash="0x73f639e161f4b51a2be71d8bbef013effd6df47db5cb5985bebcc461c1a41ac4",
        validator_agent_id=42,
        timestamp=1700000000,
        version="1.0.0",
        expiry_timestamp=1700604800,
        allowed_public_attributes=sample_public
    )

    print("=== TEST PROGRAMÁTICO DIRECTO: SELLER AGENT ===")
    
    # 1. Rol Vender: Generate listing
    listing = generate_listing(sample_public, sample_attestation)
    print(f"1. Título: {listing['title']}")

    # 2. Rol Vender: Answer FAQ
    faq = answer_faq("¿La batería dura bien?", sample_public)
    print(f"2. FAQ Respuesta: {faq['answer']}")

    # 3. Rol Vender: Evaluate offer
    policy = NegotiationPolicy(
        list_price=250.0,
        min_acceptable_price=220.0,
        auto_accept_at_or_above=245.0
    )
    offer = BuyerOffer(
        offer_id="off_test",
        buyer_address="0xBuyer",
        offered_amount=246.0,
        created_at=1700000000
    )
    decision = evaluate_offer(offer, policy)
    print(f"3. Negociación: {decision.action.value} ({decision.negotiation_band})")

    # 4. Rol Agendar: Schedule meeting
    appt = schedule_meeting(
        handoff_preference="SAFE_MEET",
        requested_slot="Jueves 16:00",
        requested_location="Centro Comercial Seguro - Plaza Norte",
        policy=policy
    )
    print(f"4. Cita Agendada: {appt['scheduled_slot']} en {appt['meeting_location']}")
    print(f"   Disclaimer: {appt['security_disclaimer'][:60]}...")
