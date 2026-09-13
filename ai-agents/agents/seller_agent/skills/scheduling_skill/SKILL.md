# Skill: Scheduling Skill (Ayni Seller Agent)

## Description
Autonomous scheduling and logistical coordination skill equipped with the `run_skill` tool for the Ayni Seller Agent.
Coordinates handoff appointments for **Safe Meet** (presential handoff at authorized secure locations)
or **Video Verify** (remote synchronous inspection).
Enforces seller availability policies and approved physical locations.

## Tools
- `run_skill`: Invokes specialized Python scheduling and location validation scripts.

## Supported Actions and Scripts
- `COORDINATE_SLOT`: `scripts/coordinate_slot_script.py`
  - Validates proposed appointment time against seller's `available_handoff_hours` and confirms booking.
- `VALIDATE_LOCATION`: `scripts/validate_location_script.py`
  - Validates physical meeting points against seller's `preferred_meet_locations` and ensures safe public locations.

## Critical Security & Protocol Rules
- **Non-Custodial Delivery Invariant**: The agent **CANNOT** confirm physical delivery or release escrowed funds in `AyniEscrow.sol`.
- **Mandatory Security Disclaimer**: Every coordinated appointment payload must include the non-custodial AyniEscrow disclaimer requiring presencial 2-of-2 multisig QR scan with 60-second Redis nonces.
