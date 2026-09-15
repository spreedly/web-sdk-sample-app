#!/usr/bin/env python3
"""Helpers for the sdk-dev-qa skill. Standard library only. Run from anywhere in the repo.

    qa.py list                                   modules in qa/modules.json
    qa.py match   --pr N | --branch [BASE] | FILE...   which modules a change touches
    qa.py touched --pr N | --branch [BASE]        which doc headings a change touches
    qa.py bundle  <module>                        SDK version on the module's rc bundle vs README

`match` exits 2 when a changed file under docs/ belongs to no module. `touched` diffs the
working tree against the merge base with BASE (default origin/main), so a checked-out PR
and planted seed defects both count. For --pr the PR must be checked out first.
"""

import json
import re
import subprocess
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CONFIG = ROOT / "qa" / "modules.json"
README = ROOT / "README.md"


def die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def modules():
    if not CONFIG.exists():
        die(f"no config at {CONFIG}")
    return json.loads(CONFIG.read_text())["modules"]


def run(*args, check=True):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode:
        die(f"{' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout


# ── what changed ─────────────────────────────────────────────────────────────

def base_for(argv):
    """Return (label, base ref) for --pr N or --branch [BASE]."""
    if argv and argv[0] == "--pr":
        if len(argv) < 2:
            die("--pr needs a number")
        info = json.loads(run("gh", "pr", "view", argv[1], "--json", "baseRefName,headRefName"))
        current = run("git", "branch", "--show-current").strip()
        if current != info["headRefName"]:
            print(f"warn: PR #{argv[1]} head is '{info['headRefName']}' but '{current}' is "
                  f"checked out — run `gh pr checkout {argv[1]}` first", file=sys.stderr)
        return f"PR #{argv[1]}", f"origin/{info['baseRefName']}"
    if argv and argv[0] == "--branch":
        base = argv[1] if len(argv) > 1 else "origin/main"
        return f"branch vs {base}", base
    return None, None


def changed_files(argv):
    label, base = base_for(argv)
    if label is None:
        if not argv:
            die("give --pr N, --branch [BASE], or file paths")
        return "files", list(argv)
    if argv[0] == "--pr":
        files = run("gh", "pr", "view", argv[1], "--json", "files", "--jq", ".files[].path").split()
        return label, files
    mb = run("git", "merge-base", base, "HEAD").strip()
    return label, run("git", "diff", "--name-only", mb).split()


def owners(files):
    """Map each changed doc file to the modules that list it."""
    ms = modules()
    hits, unmapped = {}, []
    for f in files:
        mods = [name for name, cfg in ms.items() if f in cfg["docs"]]
        if mods:
            for m in mods:
                hits.setdefault(m, []).append(f)
        elif f.startswith("docs/"):
            unmapped.append(f)
    return hits, unmapped


# ── commands ─────────────────────────────────────────────────────────────────

def cmd_list():
    ms = modules()
    print(f"{'module':<18} {'title':<40} docs  selfcheck")
    for name, cfg in sorted(ms.items()):
        n = len(cfg.get("seedDefects") or [])
        print(f"{name:<18} {cfg['title']:<40} {len(cfg['docs']):<5} {n or 'not set up'}")


def cmd_match(argv):
    label, files = changed_files(argv)
    hits, unmapped = owners(files)
    print(f"{label}: {len(files)} changed file(s)")
    for m, fs in sorted(hits.items()):
        print(f"  {m}")
        for f in fs:
            print(f"    {f}")
    if not hits:
        print("  no module docs changed — nothing to test")
    for f in unmapped:
        print(f"  UNMAPPED {f}  (under docs/ but in no module — add it to qa/modules.json)")
    if unmapped:
        sys.exit(2)


HEADING = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
MAX_LEVEL = 4  # report method/section headings, not typedoc's ##### Parameters / Example


def headings_for(text):
    """For each line index, the nearest heading (level <= MAX_LEVEL) at or above it."""
    out, current = [], None
    for line in text.splitlines():
        m = HEADING.match(line)
        if m and len(m.group(1)) <= MAX_LEVEL:
            current = m.group(2)
        out.append(current)
    return out


def heading_at(heads, line_no):
    if not heads:
        return None
    return heads[min(max(line_no - 1, 0), len(heads) - 1)]


def cmd_touched(argv):
    label, base = base_for(argv)
    if label is None:
        die("touched needs --pr N or --branch [BASE]")
    mb = run("git", "merge-base", base, "HEAD").strip()
    files = run("git", "diff", "--name-only", mb).split()
    hits, _ = owners(files)
    doc_files = sorted({f for fs in hits.values() for f in fs})
    print(f"{label}: headings touched in module docs")
    if not doc_files:
        print("  none")
        return
    for f in doc_files:
        path = ROOT / f
        if not path.exists():
            print(f"  {f} (deleted)")
            continue
        new_heads = headings_for(path.read_text())
        old_heads = headings_for(run("git", "show", f"{mb}:{f}", check=False))
        seen = []
        for line in run("git", "diff", "-U0", mb, "--", f).splitlines():
            m = HUNK.match(line)
            if not m:
                continue
            old_start = int(m.group(1))
            new_start = int(m.group(3))
            new_count = int(m.group(4)) if m.group(4) is not None else 1
            # A pure deletion has no lines in the new file: name what was removed, not its neighbour.
            h = heading_at(old_heads, old_start) if new_count == 0 else heading_at(new_heads, new_start)
            if h and h not in seen:
                seen.append(h)
        for h in seen:
            print(f"  {f} § {h}")
        if not seen:
            print(f"  {f} (changed before the first heading)")


VERSION_PATTERNS = [
    # The SDK stamps its version into the telemetry context: sdk_version:"1.7.0".
    # (Datadog's own version appears as version:"6.x" — do not match that.)
    re.compile(r"sdk_version\s*:\s*[\"'](\d+\.\d+\.\d+)[\"']"),
    # Channel tag: v:"rc-".concat("1.7.0")
    re.compile(r"\.concat\([\"'](\d+\.\d+\.\d+)[\"']\)"),
    re.compile(r"\bVERSION\s*[:=]\s*[\"'](\d+\.\d+\.\d+)[\"']"),
]
SEMVER = re.compile(r"[\"'](\d+\.\d+\.\d+)[\"']")


def cmd_bundle(argv):
    if not argv:
        die("bundle needs a module name")
    cfg = modules().get(argv[0]) or die(f"unknown module '{argv[0]}'")
    url = cfg["bundle"]["rc"]
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        die(f"could not fetch {url}: {e}")
    served, how = None, None
    for pat in VERSION_PATTERNS:
        m = pat.search(body)
        if m:
            served, how = m.group(1), f"matched {pat.pattern!r}"
            break
    if not served:
        common = Counter(SEMVER.findall(body)).most_common(1)
        if common:
            served, how = common[0][0], "most frequent semver string (heuristic)"
    readme = None
    if README.exists():
        m = re.search(r"latest released version is `(\d+\.\d+\.\d+)`", README.read_text())
        readme = m.group(1) if m else None

    print(f"bundle : {url}")
    print(f"served : {served or 'unknown'}  ({how or 'no version string found'})")
    print(f"readme : {readme or 'not stated'}  (README.md 'Latest version')")
    if served and readme:
        s, r_ = tuple(map(int, served.split("."))), tuple(map(int, readme.split(".")))
        if s >= r_:
            print("verdict: OK — the bundle is at or past the version the docs describe")
        else:
            print("verdict: STOP — the bundle is older than the docs; the SDK change has not reached rc")
            sys.exit(3)
    else:
        print("verdict: cannot compare — confirm by hand before running")


if __name__ == "__main__":
    action, rest = (sys.argv[1] if len(sys.argv) > 1 else ""), sys.argv[2:]
    if action == "list":
        cmd_list()
    elif action == "match":
        cmd_match(rest)
    elif action == "touched":
        cmd_touched(rest)
    elif action == "bundle":
        cmd_bundle(rest)
    else:
        die("usage: qa.py {list|match|touched|bundle} ...")
