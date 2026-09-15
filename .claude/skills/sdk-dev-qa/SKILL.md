---
name: sdk-dev-qa
description: Test a checkout-web-sdk module the way a merchant developer would — a fresh agent builds working integrations using ONLY what we publish (the docs and this sample app, front-end and backend) and reports everything the docs failed to tell it. Use for "run developer QA", "QA this docs PR", "test the docs", "can a developer integrate X", or before publishing docs for a new SDK feature.
argument-hint: "<module> | --pr <number> | --branch  [--step 1-5] [--selfcheck] [--list]"
---

# Developer QA — can someone integrate our SDK from what we publish?

Normal QA opens this sample app and clicks through it. That proves the SDK works. It does
not prove a **developer** can build with it, because the sample app is already written.
This skill closes that gap.

An agent plays a merchant developer. It gets what a merchant gets and nothing more. It
tries to build a working integration for everything we document. Whatever the docs fail to
tell it becomes the report.

## Run it from this repo

Everything the skill needs is in `web-sdk-sample-app`. Start Claude Code in the repo root.

| You type | What happens |
|---|---|
| `/sdk-dev-qa hosted-fields` | test one module by name |
| `/sdk-dev-qa --pr 45` | test every module whose docs PR #45 changes |
| `/sdk-dev-qa --branch` | same, for the checked-out branch against `origin/main` |
| `/sdk-dev-qa --list` | print the modules in `qa/modules.json` and stop |
| `... --step 3` | run only that step; earlier steps' output must already exist |
| `... --selfcheck` | plant known doc defects, run, restore, then check the report caught them |

Modules are defined in `qa/modules.json`, not in this skill. **Adding a module never means
editing this skill.** Add a block with its docs, pages, server files, bundle URLs, setup
steps, test data, upstream services and seed defects. Copy the `hosted-fields` block.

Two more things live in that file. `sharedDocs` lists the docs every module gets (error
keys, testing and troubleshooting guides, README, SECURITY): a change to one of them maps to
no single module, so `match` prints it as `SHARED` and you pick the modules whose flows it
affects. Modules with `runsUnder` of both SDKs carry a second bundle,
`bundleExpressCheckout`; the test list needs a case per SDK wherever the doc shows both.

Helper scripts live in `.claude/skills/sdk-dev-qa/scripts/`. Below, `qa.py` means
`python3 .claude/skills/sdk-dev-qa/scripts/qa.py`.

---

## Step 0 — Resolve the module and check preconditions

1. **Which module.** A name is looked up in `qa/modules.json`. For a PR or branch:

   ```
   gh pr checkout 45            # the docs under test must be the PR's docs
   qa.py match --pr 45          # or: qa.py match --branch
   ```

   It prints every module whose `docs` the change touches. If a changed file under `docs/`
   belongs to no module it prints `UNMAPPED` and exits 2. Stop, offer to write the block,
   and ask the user to confirm the paths before running. A `SHARED` line means a doc every
   module uses changed: ask the user which modules to run.

2. **Which headings changed.** For a PR or branch run:

   ```
   qa.py touched --pr 45        # or: qa.py touched --branch
   ```

   Keep the list. Test cases that come from those headings are flagged in the report and
   built first.

3. **The bundle already has the feature.**

   ```
   qa.py bundle hosted-fields
   ```

   It prints the SDK version served on the module's `rc` bundle and the version the README
   calls latest. If the docs describe something newer than the bundle serves, stop and say
   so. Every page would fail for reasons that have nothing to do with the docs.

4. **Fresh session.** If this chat has read SDK source (any `checkout-web-sdk` checkout),
   the agent knows things a merchant does not and the run is worthless. Start a new chat.

5. **Setup.** Do the module's `setup` steps. The backend must be reachable: `npm run dev`
   with a `.env`, or the hosted deployment named in `testData.apiBaseHeroku`.

6. **Playwright MCP** for step 3. Install it once:

   ```
   claude mcp add playwright -- npx @playwright/mcp@latest
   ```

   Without it, run steps 1, 2, 4 and 5 and mark step 3 `notrun`. The doc findings still
   stand, but nothing has been proven to work.

---

## The rule that makes this work

> **For every line of SDK code the agent writes, it must name the doc heading that told it
> to write that line. If it cannot point at one, that counts as missing from the docs —
> even if the code works.**

Not optional. It is the whole reason the exercise finds anything.

The agent already knows PayPal, Braintree and Stripe from training. Without this rule it
fills in whatever the docs left out, everything passes, and we publish docs no human can
follow.

---

## What the agent may look at

The test is "can a developer build this from what we publish". So the agent gets everything
we publish, and nothing we do not.

| Allowed | Why |
|---|---|
| The module's `docs`, plus `sharedDocs` | the thing under test |
| `README.md`, `SECURITY.md` | published alongside the docs and linked from them |
| The module's `pages` — sample app front-end | a reference integration merchants are pointed at |
| The module's `server` — sample app backend | **also a reference integration.** Our SDK needs a merchant backend: auth params are signed there, purchases happen there. A developer cannot integrate without seeing how a backend does it. |
| The running app in a browser | obvious |

| Not allowed | Why |
|---|---|
| Any `checkout-web-sdk` checkout, anywhere on disk | SDK source. Merchants get a built bundle, never this. Reading it is the one thing that invalidates the run. |
| `CLAUDE.md`, `.claude/`, `generate_test.prompt.md` | our internal notes |
| `test/` | our own end-to-end suite, not integration guidance |
| `qa/` output from earlier runs | previous answers |

Using an allowed source is not free. Anything the agent had to get from the sample app —
front-end or backend — is a **DOC-GAP**, because the docs should have said it. The sample
app is a fallback, not a substitute.

**Step 4 is the exception.** The checker agent may read anything, including SDK source if a
checkout exists. Its job is checking the first agent's homework, not being a developer.

---

## Two separate agents

Steps 2 and 4 must not share a memory. Spawn each one with the Agent tool as a fresh
`general-purpose` subagent — **not a fork**, a fork inherits this conversation. Give it, in
this order and verbatim: the brief, the module's block from `qa/modules.json`, and the
touched-heading list. Do not summarise the brief.

---

## Step 1 — Write the test list

Read every doc listed for the module. Write out every distinct thing a developer could try,
one per row.

Cover: every public method, every config option, every callback, every documented error,
every flow start to finish, and the obvious mistakes — missing required option, bad value,
wrong call order.

Format in `reference/templates.md`. Ids are `<MODULE>-NNN` and never change once committed.

**Output:** `qa/<module>/test-cases.md`

If the file already exists, do not regenerate it. Add new ids for anything new in the docs,
especially under the touched headings, and mark retired cases `retired`. If the list changed
every run you could never tell whether something broke or the agent just did something
different.

Stop and let a human read a new list before going on. Then commit it.

## Step 2 — Try to build each one

Give `reference/builder-brief.md` to a fresh agent, as described above.

One small standalone page per test case, the way a merchant would write it. Doc heading
recorded for every SDK call. When the docs do not say, it reads the sample app — front-end
or backend — and writes down exactly what it took and from where. Touched-heading cases
are built first.

**Output:** `qa/<module>/pages/*.html`, `qa/<module>/notes.md`

## Step 3 — Run the pages

Serve the pages and drive each one with Playwright MCP:

```
python3 -m http.server 4173 -d qa/<module>/pages
```

The backend allows cross-origin calls, so pages call `testData.apiBase` directly. Record:
did it render, did it complete, console errors, failed requests, screenshot into
`qa/<module>/shots/`.

Failures traceable to anything in the module's `upstream` list are marked `upstream`, not
`failed`. Do not report someone else's outage as our bug.

**Output:** `qa/<module>/results.json`

## Step 4 — Check the findings

Give `reference/auditor-brief.md` to a **different** fresh agent, with the module block,
`notes.md` and `results.json`. This one may read anything.

Every "the docs did not tell me this" claim gets one question: genuinely absent, or did the
first agent miss it? Claims that fail are dropped. Skip this and the report fills with wrong
findings and QA stops reading it.

**Output:** `qa/<module>/verified.json`

## Step 5 — Write the report

| Bucket | Meaning | Action |
|---|---|---|
| **OK** | worked, docs told it how | none |
| **DOC-GAP** | worked, but only after reading the sample app | add it to the docs |
| **UNDOCUMENTED** | worked, but no doc heading justified it | agent guessed; docs miss it entirely |
| **BROKEN** | did not work | doc is wrong, or a real bug |
| **UPSTREAM** | third-party or staging service failed | re-run later |

For a PR or branch run, the report opens with the cases under touched headings, so the
reviewer sees the new material first. End with a numbered list of doc changes, most
important first, each naming the file and heading to edit.

**Output:** `qa/<module>/report.md`

---

## Before you trust a clean report

```
python3 .claude/skills/sdk-dev-qa/scripts/seed-doc-defects.py plant hosted-fields
/sdk-dev-qa hosted-fields
python3 .claude/skills/sdk-dev-qa/scripts/seed-doc-defects.py restore hosted-fields
```

`--selfcheck` does the three in that order. The script breaks the docs on purpose using the
module's `seedDefects` list, then on restore prints what it broke so you can check the
report caught it. It refuses to plant on docs with uncommitted changes, because restore is
a `git checkout` of those files.

**If the report missed any planted defect, the harness is not working and a clean run from
it proves nothing.** Do this before QA relies on it, and again whenever the harness changes.

A module with an empty `seedDefects` list cannot be self-checked — fill it in before
trusting that module's results.

---

## Keep the run small

Do not test every combination of every option. Test each option once on its own, then five
or six realistic combinations. Nearly the same problems, a fraction of the time.

## Where output goes

```
qa/
  modules.json           every module — edit this, not the skill
  <module>/
    test-cases.md        step 1 — committed, human-reviewed, stable ids
    pages/               step 2 — generated, gitignored
    notes.md             step 2 — what it had to look up, gitignored
    shots/               step 3 — screenshots, gitignored
    results.json         step 3 — gitignored
    verified.json        step 4 — gitignored
    report.md            step 5 — the thing QA reads, committed
```

Never write into `src/`. That is the deployed sample app and also the tokenization proxy
every SDK developer's local build depends on.
