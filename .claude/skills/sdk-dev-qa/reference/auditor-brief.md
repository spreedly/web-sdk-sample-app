# Checker brief — verify the findings

Hand this file to the agent doing step 4, with the module block, `notes.md` and
`results.json`. It must be a **different** fresh agent from step 2.

---

Another agent tried to build integrations from our docs alone. It produced a list of
complaints. Your job is to throw out the wrong ones.

Unlike that agent, **you may read anything** — the served SDK bundle, a `checkout-web-sdk`
source checkout if one exists, server code, internal notes. You are not pretending to be a
developer. You are checking someone's homework.

## For each claim, answer one question

**Is this genuinely absent or wrong in the docs, or did the first agent just miss it?**

Go and look. Open the doc. Search it. If the information is there and findable, the claim
fails and you drop it.

## Verdicts

| Verdict | Meaning |
|---|---|
| `CONFIRMED` | the information really is missing, wrong, or contradictory |
| `REJECTED` | it is in the docs; the first agent missed it. Say where. |
| `PARTIAL` | present but genuinely hard to find or easy to misread. Say why. |

Default to `REJECTED` when unsure. A report that cries wolf gets ignored, and then the real
findings die with it.

## Also check the other direction

The first agent may have got something **right without the docs earning it**. For each page
it built successfully, spot-check two or three SDK calls against its citations:

- Does the cited heading actually say that?
- Did it cite a heading that only mentions the option in passing, with no explanation?

A citation that does not hold up is an `UNDOCUMENTED` finding the first agent missed.

## For BROKEN test cases, say which it is

- **doc wrong** — the docs describe something the SDK does not do.
- **sdk bug** — the docs are right, the SDK misbehaves. Say what you found in the bundle or
  source.
- **builder error** — the first agent wrote it wrong. Drop it.
- **upstream** — staging or a third-party service. Not our problem, re-run later.

This matters. A doc fix and an SDK bug go to different people.

## Output

`qa/<module>/verified.json`:

```json
{
  "module": "hosted-fields",
  "claims": [
    {
      "id": "HF-014",
      "claim": "Docs never say setPlaceholder() before 'ready' is ignored",
      "verdict": "CONFIRMED",
      "evidence": "HOSTED_FIELDS_API_REFERENCE.md § setPlaceholder() says to call it inside ready but not what happens otherwise. The bundle drops the message when no frame is mounted.",
      "fix": "Add to § setPlaceholder(): calls made before 'ready' are dropped, not queued; call it inside the ready handler.",
      "owner": "docs",
      "touchedByChange": true
    }
  ]
}
```

`owner` is `docs` or `sdk`. `touchedByChange` is true when the cited heading is in the
touched-heading list. Every confirmed claim needs a `fix` a person can act on without
rediscovering the problem.
