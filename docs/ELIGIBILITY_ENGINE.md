# Eligibility Engine

## Purpose

The eligibility engine in `core/eligibility.py` deterministically evaluates a citizen profile against all 25 government schemes and returns a **tri-state result** for each scheme:

| Status | Meaning |
|--------|---------|
| `ELIGIBLE` | All verifiable criteria pass |
| `INELIGIBLE` | At least one criterion definitively fails |
| `UNKNOWN` | Required profile fields are missing — cannot determine eligibility |

## Why Deterministic?

AI language models can hallucinate eligibility criteria. The deterministic engine:
- Uses only the verified data in `schemes.json`
- Returns reproducible results for identical inputs
- Provides machine-readable reasons for each determination
- Is the **ground truth injected into AI prompts** — the AI cannot override it

## Sentinel Strategy

Schemes with "no limit" age or income fields use sentinel constants rather than `null`:

```python
SENTINEL_MAX_AGE    = 120       # maxAge >= 100  → no official upper age limit
SENTINEL_MAX_INCOME = 10_000_000  # maxIncome >= 5,000,000 → no income ceiling
```

The engine checks:
```python
is_age_universal = scheme.get("maxAge", 0) >= 100
is_income_universal = scheme.get("maxIncome", 0) >= 5_000_000

# A sentinel scheme NEVER fails the age or income check:
if income_float > max_income and not is_income_universal:
    # INELIGIBLE on income
```

Schemes using sentinels: Ayushman Bharat, MUDRA, Stand Up India, Atal Pension Yojana, PM Vishwakarma, Beti Bachao Beti Padhao, PM-KISAN, PMJDY, PM Fasal Bima, Kisan Credit Card.

## BBBP Special Handling

Beti Bachao Beti Padhao (scheme #21) is an institutional awareness campaign, not a direct-benefit scheme. It has no individual income/age restrictions and no individual application portal. The engine returns:

```python
status = "UNKNOWN"
reasons = ["Beti Bachao Beti Padhao is an awareness and institutional scheme..."]
```

## PM-Kisan Statutory Exclusions

PM-Kisan (scheme #1) has statutory exclusion categories. The engine evaluates ALL of these:

1. Institutional landholders
2. Constitutional post holders (current/former)
3. Current/former government employees
4. Pensioners with monthly pension ≥ ₹10,000
5. Income tax payers
6. Registered professionals (doctors, engineers, lawyers, CA, architects)

If ANY exclusion is true → `INELIGIBLE` with specific reason.
If farmer + owns cultivable land + no exclusions → `ELIGIBLE`.
If farmer status or land ownership is unknown → `UNKNOWN`.

## Scheme Catalog

All 25 schemes are in `schemes.json`. Each scheme has:

```json
{
  "id": 1,
  "name": "PM-KISAN Samman Nidhi",
  "minAge": 18, "maxAge": 10000000,
  "minIncome": 0, "maxIncome": 10000000,
  "officialAge": "18+ years (no official upper limit for landholding farmers)",
  "officialIncome": "No income ceiling specified in official PM-KISAN rules",
  "officialSource": "https://pmkisan.gov.in",
  ...
}
```

`officialAge` and `officialIncome` are the human-readable, source-cited field values used in AI prompts. The engine uses the numeric `minAge`/`maxAge`/`minIncome`/`maxIncome` for evaluation.

## API Endpoint

```
POST /api/schemes/evaluate
Content-Type: application/json

{
  "age": 35,
  "income": 150000,
  "state": "Uttar Pradesh",
  "gender": "Male",
  "occupation": "Farmer",
  "socialCategory": "OBC",
  "ownsCultivableLand": true,
  "isIncomeTaxPayer": false,
  ...
}
```

Response:
```json
{
  "results": [
    {
      "scheme_id": 1,
      "scheme_name": "PM-KISAN Samman Nidhi",
      "status": "ELIGIBLE",
      "reasons": ["Farmer with verified cultivable land ownership"],
      "missing_fields": []
    },
    ...
  ]
}
```
