# Output formats

## `test-cases.md` (step 1)

Ids are `<MODULE>-NNN` and never change once committed. New cases get new numbers; retired
cases stay in the file marked `retired` so old reports still make sense.

```markdown
# Hosted Fields — developer test cases

Generated from `docs/tokenization/hosted-fields/` and `docs/HOSTED_FIELDS_API_REFERENCE.md`
on 2026-09-15. Reviewed by: <name>

| id | what a developer tries | comes from | kind |
|---|---|---|---|
| HF-001 | Initialise the SDK and get `ready` | INTEGRATION_GUIDE § Step 1 — Initialize the SDK | flow |
| HF-002 | Mount number and CVV and tokenize a Visa | INTEGRATION_GUIDE § Step 5 — Submit for tokenization | flow |
| HF-014 | Set a placeholder on the card number field | API_REFERENCE § setPlaceholder() | option |
| HF-030 | Handle `tokenGenerated` and read the token | INTEGRATION_GUIDE § Step 6 — Handle the token | callback |
| HF-055 | Submit with `month` missing and see what happens | API_REFERENCE § submit() | error |
| HF-070 | Call `destroy()` and confirm the iframes are gone | API_REFERENCE § destroy() | teardown |
```

`kind` is one of `flow`, `option`, `callback`, `error`, `teardown`.

Cover all five kinds. Error cases matter most — they are the least documented part of any
SDK and the part developers hit hardest.

---

## `results.json` (step 3)

```json
{
  "module": "hosted-fields",
  "ranAt": "2026-09-15T10:00:00Z",
  "bundle": "https://core-test.spreedly.com/checkout/sdk/rc/index.js",
  "bundleVersion": "1.7.0",
  "apiBase": "http://localhost:3000/api/v1",
  "cases": [
    {
      "id": "HF-014",
      "page": "pages/HF-014.html",
      "rendered": true,
      "completed": true,
      "consoleErrors": [],
      "failedRequests": [],
      "screenshot": "shots/HF-014.png",
      "outcome": "pass"
    }
  ]
}
```

`outcome` is `pass`, `fail`, `upstream`, or `notrun`.

---

## `report.md` (step 5)

```markdown
# Hosted Fields developer QA — 2026-09-15

Docs as of <sha> (PR #45). Bundle rc = SDK 1.7.0. 94 test cases.

## Score

| bucket | count |
|---|---|
| OK | 61 |
| DOC-GAP | 18 |
| UNDOCUMENTED | 9 |
| BROKEN | 4 |
| UPSTREAM | 2 |

**A developer following our docs alone gets 61 of 94 working — 65%.**

## Touched by this change

Cases under headings the PR changed. Read these first.

| id | heading | bucket | note |
|---|---|---|---|
| HF-081 | API_REFERENCE § setRequiredAttribute() | DOC-GAP | parameter type never stated |

## What to fix in the docs, most important first

1. **The backend route returns different key names than the constructor takes.** The
   guide lists `environment_key` and `certificate_token`; nothing says a backend may return
   them under other names and that the mapping is the merchant's job. Every developer will
   hit this in the first ten minutes. — `INTEGRATION_GUIDE.md § Authentication`
2. ...

## What is broken

| id | what happened | doc wrong or SDK bug |
|---|---|---|
| HF-041 | Example in § Step 6 reads `response.tokenResponse.payment_method.token`; the payload has no `tokenResponse` | doc wrong |

## Everything the agent had to get from the sample app

| id | what was missing | found in |
|---|---|---|
| HF-001 | how the five auth values reach the constructor | `src/static/shared/utils.js:40` |

## Worked, but the docs did not earn it

Cases where the agent produced working code without any doc heading justifying it. These
are the invisible gaps — a human developer would have been stuck.

| id | what it guessed | how it knew |
|---|---|---|
| HF-022 | `month` is two digits, `year` four | general payments knowledge |

## Not run

| id | why |
|---|---|
| HF-078 | core-test.spreedly.com returned 503 |
```

The headline number — "a developer gets N of M working" — is the thing to track release
over release. Everything else is detail behind it.
