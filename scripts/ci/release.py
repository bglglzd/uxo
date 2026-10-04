#!/usr/bin/env python3
"""Release planning and version stamping for the automated release workflow.

Commands:
  plan  [--bump auto|patch|minor|major]
      Decide whether HEAD needs a release and which version it gets, from the
      conventional commits since the last ``v*`` tag. Writes ``release``,
      ``version`` and ``previous`` to $GITHUB_OUTPUT (or stdout) and the
      release notes to ``release-notes.md``.
  stamp VERSION
      Write VERSION into every file that carries the app version.

Versioning (pre-1.0 semver): a breaking change bumps the minor version;
``feat``, ``fix`` and ``perf`` bump the patch version; other types
(docs, chore, ci, test, refactor, style, build) do not release on their own.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTES_FILE = ROOT / "release-notes.md"
RELEASE_COMMIT_PREFIX = "chore(release):"
RELEASING_TYPES = {"feat", "fix", "perf"}
CONVENTIONAL = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?:\s*(?P<subject>.+)$")
SECTIONS = [("feat", "New features"), ("fix", "Fixes"), ("perf", "Performance")]


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout.strip()


def parse_version(text: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", text.strip())
    if not match:
        raise ValueError(f"not a release version: {text!r}")
    return tuple(int(part) for part in match.groups())  # type: ignore[return-value]


def format_version(version: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in version)


def manifest_version() -> str:
    return json.loads((ROOT / "src-tauri/tauri.conf.json").read_text())["version"]


def last_release_tag() -> str | None:
    tags = [t for t in git("tag", "--list", "v*", "--merged", "HEAD").splitlines() if t]
    versions = []
    for tag in tags:
        try:
            versions.append((parse_version(tag), tag))
        except ValueError:
            continue
    return max(versions)[1] if versions else None


def commits_since(tag: str | None) -> list[tuple[str, str]]:
    """(subject, body) of first-parent commits since ``tag``, oldest first."""
    revision = f"{tag}..HEAD" if tag else "HEAD"
    raw = git("log", "--reverse", "--format=%s%x1f%b%x1e", revision)
    commits = []
    for entry in raw.split("\x1e"):
        entry = entry.strip("\n")
        if not entry:
            continue
        subject, _, body = entry.partition("\x1f")
        commits.append((subject.strip(), body.strip()))
    return commits


def classify(commits: list[tuple[str, str]]) -> tuple[str | None, dict[str, list[str]]]:
    """Return the bump level ('minor', 'patch' or None) and grouped subjects."""
    bump: str | None = None
    groups: dict[str, list[str]] = {key: [] for key, _ in SECTIONS}
    for subject, body in commits:
        if subject.startswith(RELEASE_COMMIT_PREFIX):
            continue
        match = CONVENTIONAL.match(subject)
        if not match:
            continue
        kind = match["type"]
        breaking = bool(match["bang"]) or "BREAKING CHANGE" in body
        if breaking:
            bump = "minor"
        elif kind in RELEASING_TYPES and bump is None:
            bump = "patch"
        if kind in groups:
            scope = f"**{match['scope']}:** " if match["scope"] else ""
            groups[kind].append(f"- {scope}{match['subject']}")
    return bump, groups


def bump_version(version: tuple[int, int, int], level: str) -> tuple[int, int, int]:
    major, minor, patch = version
    if level == "major":
        return (major + 1, 0, 0)
    if level == "minor":
        return (major, minor + 1, 0)
    return (major, minor, patch + 1)


def release_notes(version: str, previous: str | None, groups: dict[str, list[str]]) -> str:
    curated = ROOT / "docs" / "releases" / f"v{version}.md"
    if curated.exists():
        return curated.read_text()

    repo = os.environ.get("GITHUB_REPOSITORY", "bglglzd/uxo")
    lines = [f"# UXO v{version}", ""]
    for key, title in SECTIONS:
        if groups[key]:
            lines += [f"## {title}", "", *groups[key], ""]
    lines += [
        "## Download",
        "",
        f"- [UXO_{version}_x64-setup.exe](https://github.com/{repo}/releases/download/v{version}/UXO_{version}_x64-setup.exe) — standard installer",
        f"- [UXO_{version}_x64_en-US.msi](https://github.com/{repo}/releases/download/v{version}/UXO_{version}_x64_en-US.msi) — MSI package",
        f"- [SHA256SUMS.txt](https://github.com/{repo}/releases/download/v{version}/SHA256SUMS.txt) — checksums",
        "",
        "UXO installs updates from inside the app (Settings → About → Updates). "
        "The installers are not code-signed, so Windows SmartScreen may show an "
        "“Unknown publisher” warning on a fresh install.",
    ]
    if previous:
        lines += ["", f"**Full changelog:** https://github.com/{repo}/compare/{previous}...v{version}"]
    return "\n".join(lines) + "\n"


def write_outputs(values: dict[str, str]) -> None:
    target = os.environ.get("GITHUB_OUTPUT")
    text = "".join(f"{key}={value}\n" for key, value in values.items())
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(text)
    else:
        sys.stdout.write(text)


def plan(forced: str) -> None:
    head_subject = git("log", "-1", "--format=%s")
    if head_subject.startswith(RELEASE_COMMIT_PREFIX) and forced == "auto":
        write_outputs({"release": "false", "version": "", "previous": ""})
        print("HEAD is a release commit; nothing to do.", file=sys.stderr)
        return

    previous = last_release_tag()
    commits = commits_since(previous)
    level, groups = classify(commits)
    if forced != "auto":
        level = forced
    if level is None:
        write_outputs({"release": "false", "version": "", "previous": previous or ""})
        print("No feat/fix/perf or breaking commits since the last release.", file=sys.stderr)
        return

    base = parse_version(previous) if previous else (0, 0, 0)
    candidate = bump_version(base, level)
    # A version already prepared in the manifests (e.g. by a hand-written
    # "prepare vX" commit) wins when it is ahead of the computed one.
    prepared = parse_version(manifest_version())
    version = format_version(max(candidate, prepared) if prepared > base else candidate)

    NOTES_FILE.write_text(release_notes(version, previous, groups))
    write_outputs({"release": "true", "version": version, "previous": previous or ""})
    print(f"Releasing v{version} ({level}) after {previous or 'no previous tag'}.", file=sys.stderr)


def replace_in(path: Path, pattern: str, replacement: str, count: int = 0) -> None:
    text = path.read_text(encoding="utf-8")
    updated, n = re.subn(pattern, replacement, text, count=count, flags=re.MULTILINE)
    if n == 0:
        raise SystemExit(f"{path.relative_to(ROOT)}: pattern not found: {pattern}")
    path.write_text(updated, encoding="utf-8")


def stamp(version: str) -> None:
    parse_version(version)
    old = manifest_version()

    for name in ("package.json", "src-tauri/tauri.conf.json"):
        replace_in(ROOT / name, r'^(  "version": )"[^"]+"', rf'\g<1>"{version}"', count=1)
    replace_in(ROOT / "src-tauri/Cargo.toml", r'^version = "[^"]+"', f'version = "{version}"', count=1)
    replace_in(
        ROOT / "src-tauri/Cargo.lock",
        r'^(name = "uxo"\nversion = )"[^"]+"',
        rf'\g<1>"{version}"',
        count=1,
    )
    for name in (
        "src/components/footer/Footer.tsx",
        "src/components/settings/about/AboutSettings.tsx",
    ):
        replace_in(ROOT / name, r'setVersion\("[^"]+"\)', f'setVersion("{version}")')

    if old != version:
        # Download links and "this release" wording in the public docs.
        for name in (
            "README.md",
            "docs/README.ru.md",
            "THIRD_PARTY_NOTICES.md",
            "src-tauri/resources/legal/THIRD_PARTY_NOTICES.md",
        ):
            path = ROOT / name
            # Lines linking older release notes ("docs/releases/vX.md") keep
            # their version; everything else moves to the new one, including
            # shields.io badge text such as "Download_UXO_vX-Windows_x64".
            version_pattern = re.compile(rf"(?<![\d.])v{re.escape(old)}(?!\d)(?!\.md)")
            lines = path.read_text(encoding="utf-8").split("\n")
            for index, line in enumerate(lines):
                if f"releases/v{old}.md" in line:
                    continue
                line = version_pattern.sub(f"v{version}", line)
                lines[index] = line.replace(f"UXO_{old}_", f"UXO_{version}_")
            text = "\n".join(lines)
            path.write_text(text, encoding="utf-8")
    print(f"Stamped version {version} (was {old}).", file=sys.stderr)


def main(argv: list[str]) -> None:
    if len(argv) >= 1 and argv[0] == "plan":
        forced = "auto"
        if len(argv) == 3 and argv[1] == "--bump":
            forced = argv[2]
        if forced not in {"auto", "patch", "minor", "major"}:
            raise SystemExit(f"invalid --bump {forced!r}")
        plan(forced)
    elif len(argv) == 2 and argv[0] == "stamp":
        stamp(argv[1])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
