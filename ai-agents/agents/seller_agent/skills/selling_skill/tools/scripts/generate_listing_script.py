# SPDX-License-Identifier: MIT
"""Listing generation script executed via selling_skill run_skill tool."""

from typing import Dict, Any, Optional
from shared.schemas.product_schemas import PublicTechnicalAttributes
from shared.schemas.attestation_schemas import AttestationResult, ValidationVerdict
from shared.privacy_guard import PrivacyGuard


def execute(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generates an attractive, fully certified marketplace listing.
    
    Args:
        input_data: Dictionary containing:
            - public_attributes: Dict or PublicTechnicalAttributes
            - attestation: Dict or AttestationResult
            - seller_notes: Optional string
            
    Returns:
        Structured listing dictionary containing title, description, checklist, faqs, and summary.
    """
    raw_public = input_data.get("public_attributes") or {}
    raw_attestation = input_data.get("attestation") or {}
    seller_notes = input_data.get("seller_notes") or ""

    if isinstance(raw_public, dict):
        public_attrs = PublicTechnicalAttributes(**raw_public)
    else:
        public_attrs = raw_public

    if isinstance(raw_attestation, dict):
        attestation = AttestationResult(**raw_attestation)
    else:
        attestation = raw_attestation

    # Strict privacy barrier assertions
    PrivacyGuard.assert_zero_privacy_leakage(public_attrs.model_dump())
    PrivacyGuard.assert_zero_privacy_leakage(attestation.model_dump())

    storage_text = f" {public_attrs.storage_gb}GB" if public_attrs.storage_gb else ""
    verdict_badge = "Verificado Ayni" if attestation.verdict == ValidationVerdict.PASS else "Verificación Ayni con Observaciones"
    title = f"{public_attrs.brand} {public_attrs.model}{storage_text} - Condición {public_attrs.condition_rating}/5 ({verdict_badge})"

    # Certified physical checklist items
    checklist = [
        f"Marca y Modelo: {public_attrs.brand} {public_attrs.model}",
        f"Condición Física: {public_attrs.condition_rating} de 5",
        f"Estado de Operador / Cuentas: {public_attrs.carrier_status}",
    ]
    if public_attrs.battery_health is not None:
        checklist.append(f"Salud de Batería Diagnóstica: {public_attrs.battery_health}%")
    if public_attrs.storage_gb:
        checklist.append(f"Capacidad de Almacenamiento: {public_attrs.storage_gb} GB")
    if public_attrs.ram_gb:
        checklist.append(f"Memoria RAM: {public_attrs.ram_gb} GB")
    if public_attrs.cosmetic_notes:
        checklist.append(f"Detalles Cosméticos: {public_attrs.cosmetic_notes}")

    # Grounded FAQs
    faqs = [
        {
            "question": "¿El equipo está liberado y listo para usar?",
            "answer": f"Sí, el estado verificado es '{public_attrs.carrier_status}' sin bloqueos activos."
        },
        {
            "question": "¿Qué estado estético y funcional tiene?",
            "answer": f"Calificación de condición {public_attrs.condition_rating}/5 con verificación técnica por agente ERC-8004."
        }
    ]
    if public_attrs.battery_health is not None:
        faqs.append({
            "question": "¿Cuál es el estado de la batería?",
            "answer": f"La batería reporta un estado de salud del {public_attrs.battery_health}% en el diagnóstico verificado."
        })

    # Structured markdown description
    description_md = f"""### {public_attrs.brand} {public_attrs.model}
**Condición Certificada:** {public_attrs.condition_rating}/5  
**Almacenamiento:** {public_attrs.storage_gb or 'N/A'} GB  
**Operador:** {public_attrs.carrier_status}  
**Dictamen Técnico:** {attestation.verdict.name} (Confianza: {attestation.confidence_score * 100:.0f}%)  
**Compromiso de Validación On-Chain (requestHash):** `{attestation.request_hash}`  

#### Checklist Técnico Verificado:
""" + "\n".join([f"- {item}" for item in checklist])

    if seller_notes:
        sanitized_notes = PrivacyGuard.sanitize_text(seller_notes)
        description_md += f"\n\n#### Notas del Vendedor:\n{sanitized_notes}"

    listing_payload = {
        "title": title,
        "description": description_md,
        "checklist": checklist,
        "faqs": faqs,
        "public_attributes": public_attrs.model_dump(),
        "attestation_summary": {
            "verdict": attestation.verdict.value,
            "verdict_name": attestation.verdict.name,
            "confidence_score": attestation.confidence_score,
            "request_hash": attestation.request_hash,
            "validator_agent_id": attestation.validator_agent_id,
        }
    }

    PrivacyGuard.assert_zero_privacy_leakage(listing_payload)
    return listing_payload
