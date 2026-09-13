# SPDX-License-Identifier: MIT
"""Autonomous price negotiation state matrix for the Ayni Seller Agent.

Enforces strict mathematical pricing boundaries defined by the seller:
Band 1 (offer >= list_price): ACCEPT
Band 2 (auto_accept <= offer < list_price): AUTO_ACCEPT
Band 3 (min_acceptable <= offer < auto_accept): REQUEST_SELLER_APPROVAL / COUNTER_OFFER
Band 4 (offer < min_acceptable): REJECT (polite refusal with range explanation)
Band 5 (offer expired): INVALID_EXPIRED
"""

from shared.schemas.negotiation_schemas import (
    BuyerOffer,
    NegotiationPolicy,
    NegotiationDecision,
    NegotiationAction
)


def evaluate_buyer_offer(offer: BuyerOffer, policy: NegotiationPolicy) -> NegotiationDecision:
    """Evaluates an incoming buyer offer against the seller's negotiation policy.
    
    Args:
        offer: The buyer's structured offer.
        policy: The seller's configured pricing parameters.
        
    Returns:
        NegotiationDecision containing the action, amounts, and explanatory message.
    """
    # Band 5: Expired Offer
    if offer.is_expired:
        return NegotiationDecision(
            action=NegotiationAction.INVALID_EXPIRED,
            offered_amount=offer.offered_amount,
            counter_offer_amount=None,
            response_message="La oferta enviada ha expirado. Por favor emita una nueva oferta.",
            requires_seller_approval=False,
            negotiation_band="EXPIRED"
        )

    # Determine auto-accept threshold (default to list price if not specified)
    auto_accept_threshold = policy.auto_accept_at_or_above
    if auto_accept_threshold is None:
        auto_accept_threshold = policy.list_price

    # Band 1: Offer at or above listing price
    if offer.offered_amount >= policy.list_price:
        return NegotiationDecision(
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

    # Band 2: Offer within auto-accept discount range [auto_accept_threshold, list_price)
    if offer.offered_amount >= auto_accept_threshold:
        return NegotiationDecision(
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

    # Band 3: Offer between floor price and auto-accept threshold [min_acceptable, auto_accept_threshold)
    if offer.offered_amount >= policy.min_acceptable_price:
        # Calculate optimal counter-offer: midpoint between offer and auto-accept threshold
        counter_amount = round((offer.offered_amount + auto_accept_threshold) / 2.0, 2)
        if policy.require_seller_approval:
            return NegotiationDecision(
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
            return NegotiationDecision(
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

    # Band 4: Offer strictly below minimum acceptable price (< min_acceptable)
    return NegotiationDecision(
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
