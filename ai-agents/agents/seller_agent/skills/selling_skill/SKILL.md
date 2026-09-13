# Skill: Selling Skill (Ayni Seller Agent)

## Description
Autonomous commercial selling skill equipped with the `run_skill` tool for the Ayni Seller Agent.
Operates strictly under the Ayni Privacy Barrier. Generates certified marketplace listings,
compiles structured physical checklists, produces grounded FAQs without hallucination,
and executes autonomous pricing negotiations across the seller's 5-band mathematical policy.

## Tools
- `run_skill`: Invokes specialized Python commercial selling scripts based on the requested action.

## Supported Actions and Scripts
- `GENERATE_LISTING`: `scripts/generate_listing_script.py`
  - Formats listing title, markdown description, verified checklist, and ERC-8004 attestation badge.
- `NEGOTIATE_PRICE`: `scripts/negotiate_price_script.py`
  - Evaluates incoming buyer offers across 5 mathematical pricing bands (ACCEPT, AUTO_ACCEPT, REQUEST_SELLER_APPROVAL / COUNTER_OFFER, REJECT, INVALID_EXPIRED).
- `ANSWER_FAQ`: `scripts/answer_faq_script.py`
  - Answers buyer inquiries strictly grounded on certified technical attributes (carrier lock, battery health, condition).

## Privacy & Security Rules
- Only receives certified `PublicTechnicalAttributes` and `AttestationResult`.
- Never accesses, receives, or outputs private hardware identifiers (IMEI, serial numbers) or private evidence storage paths.
- All outputs are audited with `PrivacyGuard.assert_zero_privacy_leakage`.
