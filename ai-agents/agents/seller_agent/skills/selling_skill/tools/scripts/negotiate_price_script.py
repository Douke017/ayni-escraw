# SPDX-License-Identifier: MIT
"""Price negotiation script executed via selling_skill run_skill tool."""

from typing import Dict, Any
from shared.schemas.negotiation_schemas import (
    BuyerOffer,
    NegotiationPolicy,
    NegotiationDecision,
    NegotiationAction
)


def execute(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates a buyer offer against the seller's negotiation policy.
    
    Args:
        input_data: Dictionary containing:
            - offer: Dict or BuyerOffer
            - policy: Dict or NegotiationPolicy
            
    Returns:
        Dictionary representation of NegotiationDecision.
    """
    raw_offer = input_data.get("offer") or {}
    raw_policy = input_data.get("policy") or {}

    offer = BuyerOffer(**raw_offer) if isinstance(raw_offer, dict) else raw_offer
    policy = NegotiationPolicy(**raw_policy) if isinstance(raw_policy, dict) else raw_policy

    # Band 5: Expired Offer
    if offer.is_expired:
        decision = NegotiationDecision(
            action=NegotiationAction.INVALID_EXPIRED,
            offered_amount=offer.offered_amount,
            counter_offer_amount=None,
            response_message="La oferta enviada ha expirado. Por favor emita una nueva oferta.",
            requires_seller_approval=False,
            negotiation_band="EXPIRED"
        )
        return decision.model_dump()

    auto_accept_threshold = policy.auto_accept_at_or_above
    if auto_accept_threshold is None:
        auto_accept_threshold = policy.list_price

    # Band 1: Offer at or above listing price
    if offer.offered_amount >= policy.list_price:
        decision = NegotiationDecision(
            action=NegotiationAction.ACCEPT,
            offered_amount=offer.offered_amount,
            counter_offer_amount=None,
            response_message=(
                f"Oferta de {offer.offered_amount:.2f} USDT aceptada satisfactoriamente. "
                "Puede proceder con el depósito de garantía en AyniEscrow."
            ),
            requires_seller_approval=False,
            negotiation_band="FULL_PRICE_OR_ABOVE"
        )
        return decision.model_dump()

    # Band 2: Offer within auto-accept discount range [auto_accept_threshold, list_price)
    if offer.offered_amount >= auto_accept_threshold:
        decision = NegotiationDecision(
            action=NegotiationAction.AUTO_ACCEPT,
            offered_amount=offer.offered_amount,
            counter_offer_amount=None,
            response_message=(
                f"Oferta de {offer.offered_amount:.2f} USDT aceptada automáticamente según la política de descuento del vendedor. "
                "Tiene un plazo de 24 horas para depositar en AyniEscrow."
            ),
            requires_seller_approval=False,
            negotiation_band="AUTO_ACCEPT_RANGE"
        )
        return decision.model_dump()

    # Band 3: Offer between floor price and auto-accept threshold [min_acceptable, auto_accept_threshold)
    if offer.offered_amount >= policy.min_acceptable_price:
        counter_amount = round((offer.offered_amount + auto_accept_threshold) / 2.0, 2)
        if policy.require_seller_approval:
            decision = NegotiationDecision(
                action=NegotiationAction.REQUEST_SELLER_APPROVAL,
                offered_amount=offer.offered_amount,
                counter_offer_amount=counter_amount,
                response_message=(
                    f"Oferta de {offer.offered_amount:.2f} USDT recibida en rango de negociación. "
                    f"Pendiente de confirmación del vendedor. Sugerencia de contraoferta: {counter_amount:.2f} USDT."
                ),
                requires_seller_approval=True,
                negotiation_band="SELLER_APPROVAL_REQUIRED"
            )
        else:
            decision = NegotiationDecision(
                action=NegotiationAction.COUNTER_OFFER,
                offered_amount=offer.offered_amount,
                counter_offer_amount=counter_amount,
                response_message=(
                    f"Su oferta de {offer.offered_amount:.2f} USDT es menor a la compra directa. "
                    f"Le proponemos una contraoferta de {counter_amount:.2f} USDT para cerrar el trato hoy."
                ),
                requires_seller_approval=False,
                negotiation_band="COUNTER_OFFER_DIRECT"
            )
        return decision.model_dump()

    # Band 4: Offer strictly below minimum acceptable price (< min_acceptable)
    decision = NegotiationDecision(
        action=NegotiationAction.REJECT,
        offered_amount=offer.offered_amount,
        counter_offer_amount=policy.min_acceptable_price,
        response_message=(
            f"Oferta de {offer.offered_amount:.2f} USDT declinada. "
            f"El precio mínimo de reserva establecido por el vendedor es de {policy.min_acceptable_price:.2f} USDT. "
            "Le invitamos a presentar una propuesta dentro del rango permitido."
        ),
        requires_seller_approval=False,
        negotiation_band="BELOW_FLOOR_PRICE"
    )
    return decision.model_dump()
