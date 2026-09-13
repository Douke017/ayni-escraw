# SPDX-License-Identifier: MIT
"""End-to-end verification of the 100% programmatic workflow without any HTTP endpoints."""

import pytest
from agents import (
    extract_specs,
    process_listing_pipeline,
    verify_product,
    generate_listing,
    evaluate_offer,
    answer_faq,
    schedule_meeting,
    validate_meet_location,
    record_validation_onchain
)
from app.models import HardwareSpecExtractionRequest
from shared.schemas.product_schemas import PrivateVerificationInput, CategoryEnum
from shared.schemas.attestation_schemas import ValidationVerdict
from shared.schemas.negotiation_schemas import BuyerOffer, NegotiationPolicy, NegotiationAction


def test_complete_programmatic_workflow_zero_endpoints():
    # -------------------------------------------------------------
    # PASO 1: Extracción de especificaciones desde texto crudo
    # -------------------------------------------------------------
    spec_req = HardwareSpecExtractionRequest(
        title="iPhone 13 Pro 128GB Grafito",
        description="iPhone 13 Pro en excelente estado, bateria 88%, libre de fábrica, 128GB",
        declared_category="Smartphone"
    )
    specs = extract_specs(spec_req)
    assert specs.brand == "Apple"
    assert specs.storage == "128GB"
    assert specs.confidence_score >= 0.85

    # -------------------------------------------------------------
    # PASO 2: Verificación de hardware con barrera estricta de privacidad
    # -------------------------------------------------------------
    verification_input = PrivateVerificationInput(
        category=CategoryEnum.SMARTPHONE,
        brand=specs.brand,
        model=specs.model,
        raw_description=spec_req.description,
        declared_condition=4,
        imei="354892091234569",  # Luhn válido (privado, nunca filtrado)
        photos_urls=["ayni-evidence-private/item_front.jpg", "ayni-evidence-private/item_back.jpg"],
        battery_health_percentage=88,
        storage_gb=128,
        ram_gb=6,
        account_lock_status="unlocked",
        functional_tests={"screen_touch": True, "cameras": True, "cellular": True}
    )
    attestation = verify_product(verification_input)
    assert attestation.verdict == ValidationVerdict.PASS
    assert attestation.request_hash.startswith("0x")
    # Comprobar que atributos públicos no contienen datos privados
    assert "imei" not in attestation.allowed_public_attributes.model_dump()

    # -------------------------------------------------------------
    # PASO 3: Generación comercial de publicación (Rol Vender)
    # -------------------------------------------------------------
    listing = generate_listing(
        public_attrs=attestation.allowed_public_attributes,
        attestation=attestation,
        seller_notes="Viene con caja original"
    )
    assert "Apple iPhone 13 Pro 128GB" in listing["title"]
    assert "Verificado Ayni" in listing["title"]
    assert len(listing["checklist"]) >= 4

    # -------------------------------------------------------------
    # PASO 4: Respuestas a FAQs fundamentadas en specs verificadas
    # -------------------------------------------------------------
    faq_battery = answer_faq("¿Qué porcentaje de batería tiene?", attestation.allowed_public_attributes)
    assert "88%" in faq_battery["answer"]

    faq_carrier = answer_faq("¿Funciona con cualquier chip?", attestation.allowed_public_attributes)
    assert "Unlocked" in faq_carrier["answer"]

    # -------------------------------------------------------------
    # PASO 5: Negociación autónoma en 5 bandas de precio
    # -------------------------------------------------------------
    policy = NegotiationPolicy(
        list_price=250.0,
        min_acceptable_price=220.0,
        auto_accept_at_or_above=245.0,
        require_seller_approval=True,
        available_handoff_hours=["Lunes a Viernes 14:00 - 18:00"],
        preferred_meet_locations=["Centro Comercial Seguro - Plaza Norte"]
    )

    # Oferta $248 -> Auto-accept
    offer_auto = BuyerOffer(offer_id="o_auto", buyer_address="0xBuyer1", offered_amount=248.0, created_at=100)
    dec_auto = evaluate_offer(offer_auto, policy)
    assert dec_auto.action == NegotiationAction.AUTO_ACCEPT

    # Oferta $230 -> Seller approval required
    offer_appr = BuyerOffer(offer_id="o_appr", buyer_address="0xBuyer2", offered_amount=230.0, created_at=100)
    dec_appr = evaluate_offer(offer_appr, policy)
    assert dec_appr.action == NegotiationAction.REQUEST_SELLER_APPROVAL
    assert dec_appr.counter_offer_amount == 237.50

    # Oferta $210 -> Reject (below floor)
    offer_rej = BuyerOffer(offer_id="o_rej", buyer_address="0xBuyer3", offered_amount=210.0, created_at=100)
    dec_rej = evaluate_offer(offer_rej, policy)
    assert dec_rej.action == NegotiationAction.REJECT

    # -------------------------------------------------------------
    # PASO 6: Agendamiento logístico Safe Meet (Rol Agendar)
    # -------------------------------------------------------------
    # Comprobar ubicación
    loc_val = validate_meet_location("Plaza Norte", policy)
    assert loc_val["is_valid"] is True

    # Coordinar cita
    appointment = schedule_meeting(
        handoff_preference="SAFE_MEET",
        requested_slot="Jueves 15:00",
        requested_location="Centro Comercial Seguro - Plaza Norte",
        policy=policy
    )
    assert appointment["status"] == "COORDINATED"
    assert appointment["scheduled_slot"] == "Jueves 15:00"
    assert "AyniEscrow" in appointment["security_disclaimer"]

    # -------------------------------------------------------------
    # PASO 7: Atestación On-Chain Web3 ERC-8004
    # -------------------------------------------------------------
    tx_res = record_validation_onchain(
        listing_id=attestation.request_hash,
        agent_id=42,
        dictum=int(attestation.verdict),
        proof_hash=attestation.request_hash
    )
    assert tx_res["success"] is True
    assert tx_res["tx_hash"].startswith("0x")
