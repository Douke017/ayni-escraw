# Skill: Validate Product Skill

## Description
Dynamic hardware validation skill equipped with the `run_script` tool for the Ayni Product Verification Agent. Executes category-specific validation scripts (Smartphones, Laptops, Components) to verify physical specs, battery health, lock status, and detect fraudulent or exaggerated claims before minting digital passports on HSK Chain.

## Tools
- `run_script`: Invokes specialized Python validation scripts per product category.

## Supported Categories and Scripts
- `SMARTPHONE`: `scripts/validate_smartphone.py`
- `LAPTOP`: `scripts/validate_laptop.py`
- `COMPONENT`: `scripts/validate_component.py`

## Privacy & Security Rules
- All diagnostic scripts run locally in memory.
- Confidential hardware identifiers (IMEI, serial numbers) are validated (e.g. Luhn algorithm check) and then salted or dropped.
- Outputs only structured validation results (`PASS`, `WARN`, `FAIL`), rationale, and approved public specifications.
