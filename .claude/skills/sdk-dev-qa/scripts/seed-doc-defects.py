#!/usr/bin/env python3
"""Plant known mistakes in a module's docs, so you can check the harness finds them.

    seed-doc-defects.py plant   <module>
    ... run the harness, read the report ...
    seed-doc-defects.py restore <module>
    seed-doc-defects.py list

If the report does not name the planted defects, the harness is not working and a clean
report from it means nothing.

Defects come from `seedDefects` in qa/modules.json — nothing here is module-specific.
Restore is `git checkout` on the doc files, so plant refuses to run unless they are clean.

Defect kinds:
  deleteRow      {"match": "expiry"}                 remove a table row or bullet for an option
  deleteSection  {"match": "setPlaceholder()"}       remove a heading and its body (typedoc-style refs)
  rename         {"from": "tokenGenerated", "to": "tokenGenerate"}   rename a method/event everywhere
  dropAwait      {"match": "submit("}                strip the first `await` on a matching example line
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CONFIG = ROOT / "qa" / "modules.json"


def die(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def load(module):
    if not CONFIG.exists():
        die(f"no config at {CONFIG}")
    mods = json.loads(CONFIG.read_text())["modules"]
    if module not in mods:
        die(f"unknown module '{module}'. Known: {', '.join(sorted(mods))}")
    return mods[module]


def doc_paths(cfg):
    rel = []
    for d in cfg["docs"]:
        if (ROOT / d).exists():
            rel.append(d)
        else:
            print(f"  warn: missing doc {d}")
    return rel


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True).stdout


# ── the defect kinds ─────────────────────────────────────────────────────────

def apply_delete_row(path, match):
    """Remove a table row or bullet describing an option — it becomes undocumented."""
    lines = path.read_text().splitlines(keepends=True)
    pat = re.compile(r"^\s*[|\-*]\s*`?" + re.escape(match) + r"`?\b")
    for i, line in enumerate(lines):
        if pat.match(line):
            del lines[i]
            path.write_text("".join(lines))
            return f"deleted the `{match}` row from {path.name} (line {i + 1})"
    return None


def apply_delete_section(path, match):
    """Remove a heading and everything under it up to the next heading of the same or
    higher level, or the next `***` rule (typedoc puts one between members)."""
    lines = path.read_text().splitlines(keepends=True)
    head = re.compile(r"^(#{1,6})\s+" + re.escape(match) + r"\s*$")
    start = level = None
    for i, line in enumerate(lines):
        m = head.match(line)
        if m:
            start, level = i, len(m.group(1))
            break
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        m = re.match(r"^(#{1,6})\s", lines[j])
        if m and len(m.group(1)) <= level:
            end = j
            break
        if lines[j].strip() == "***":
            end = j + 1
            break
    del lines[start:end]
    path.write_text("".join(lines))
    return f"deleted the `{match}` section from {path.name} (lines {start + 1}-{end})"


def apply_rename(path, frm, to):
    """Rename a callback/method so every example calls something that does not exist."""
    text = path.read_text()
    n = text.count(frm)
    if not n:
        return None
    path.write_text(text.replace(frm, to))
    return f"renamed `{frm}` to `{to}` in {n} place(s) in {path.name}"


def apply_drop_await(path, match):
    """Strip an await inside a fenced example so the sample races."""
    out, in_fence, done = [], False, False
    for line in path.read_text().splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
        elif in_fence and not done and "await " in line and match in line:
            line = line.replace("await ", "", 1)
            done = True
        out.append(line)
    if not done:
        return None
    path.write_text("".join(out))
    return f"dropped `await` before `{match}` in the first example in {path.name}"


KINDS = {
    "deleteRow": lambda p, d: apply_delete_row(p, d["match"]),
    "deleteSection": lambda p, d: apply_delete_section(p, d["match"]),
    "rename": lambda p, d: apply_rename(p, d["from"], d["to"]),
    "dropAwait": lambda p, d: apply_drop_await(p, d["match"]),
}


# ── commands ─────────────────────────────────────────────────────────────────

def manifest_for(module):
    return ROOT / "qa" / module / ".seeded-defects.md"


def plant(module):
    cfg = load(module)
    defects = cfg.get("seedDefects") or []
    if not defects:
        die(f"'{module}' has no seedDefects in qa/modules.json. Add some before trusting its results.")

    rel = doc_paths(cfg)
    dirty = git("status", "--porcelain", "--", *rel).strip()
    if dirty:
        die(f"docs for '{module}' have uncommitted changes — restore uses git checkout.\n{dirty}")

    applied = []
    for d in defects:
        path = ROOT / d["file"]
        if not path.exists():
            print(f"  warn: {d['file']} does not exist, skipping")
            continue
        fn = KINDS.get(d["kind"])
        if not fn:
            print(f"  warn: unknown defect kind '{d['kind']}', skipping")
            continue
        what = fn(path, d)
        if what:
            applied.append(f"{what} — {d.get('note', '')}".strip(" —"))
        else:
            print(f"  warn: could not apply {d['kind']} to {path.name} (target not found)")

    if not applied:
        die("nothing was planted — check the seedDefects targets still exist in the docs")

    manifest = manifest_for(module)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest.write_text(
        f"# Planted defects — {module} — {stamp}\n\n"
        "Do NOT read this before running the harness. Compare afterwards.\n\n"
        + "".join(f"{i}. {w}\n" for i, w in enumerate(applied, 1))
    )

    print(f"\nPlanted {len(applied)} of {len(defects)} defect(s) in {module} docs.")
    print(f"Manifest: {manifest.relative_to(ROOT)}  (do not read it until the harness has run)")
    print(f"\nNow run the harness, then: {sys.argv[0]} restore {module}")
    if len(applied) != len(defects):
        sys.exit(1)


def restore(module):
    cfg = load(module)
    rel = doc_paths(cfg)
    subprocess.run(["git", "-C", str(ROOT), "checkout", "--", *rel], check=True)
    print(f"Restored {module} docs from git.")

    manifest = manifest_for(module)
    if manifest.exists():
        print("\nWhat was planted:\n")
        print(manifest.read_text())
        print("Every one should appear in the report. Any that does not is a hole in the harness.")


def list_modules():
    mods = json.loads(CONFIG.read_text())["modules"]
    print(f"{'module':<18} {'title':<40} selfcheck")
    for name, cfg in sorted(mods.items()):
        n = len(cfg.get("seedDefects") or [])
        print(f"{name:<18} {cfg['title']:<40} {n or 'not set up'}")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    if action == "list":
        list_modules()
    elif action in ("plant", "restore"):
        if len(sys.argv) < 3:
            die(f"usage: {sys.argv[0]} {action} <module>")
        (plant if action == "plant" else restore)(sys.argv[2])
    else:
        die(f"usage: {sys.argv[0]} {{plant|restore|list}} [module]")
