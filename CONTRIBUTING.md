# Contributing to UXO

UXO is a privacy-first desktop dictation app. Contributions should preserve its core promise: microphone audio and ordinary transcription remain local, startup stays quiet, and the Windows default does not compete with games for GPU time.

## Set up

Install the latest stable Rust toolchain and Bun, then follow [BUILD.md](BUILD.md). On Windows, use the verified Visual Studio CMake/Ninja recipe in that guide; a plain `cargo build` can hit the `transcribe-cpp-sys` junction issue.

```bash
bun install
bun run tauri dev
```

The development VAD resource is tracked at `src-tauri/resources/models/silero_vad_v4.onnx`; [BUILD.md](BUILD.md) contains the complete build guidance.

## Make a change

- Keep each change focused and preserve unrelated work in the tree.
- Use i18next for every user-facing string.
- Keep secrets, recordings, model files, and generated local data out of Git.
- Add tests for behavior changes, especially language handling, clipboard restoration, shortcuts, and accelerator selection.
- Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, and `chore:`.

Before submitting, run:

```bash
bun run lint
bun run build
bun run check:translations
bun run format:check
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Native Windows commands need the environment described in [BUILD.md](BUILD.md).

## Pull requests

Read and complete [the pull-request template](.github/PULL_REQUEST_TEMPLATE.md). Its Human Written Description and AI Assistance sections are required. Include concrete test evidence and screenshots for visible changes.

## Releases

Releases are automatic. When a merge to `main` contains a `feat:`, `fix:` or `perf:` commit since the last `v*` tag, the [Release workflow](.github/workflows/release.yml):

1. picks the next version: `feat`/`fix`/`perf` bump the patch version, and a breaking change (`feat!:` or a `BREAKING CHANGE:` footer) bumps the minor version while UXO is below 1.0;
2. writes it into `package.json`, `tauri.conf.json`, `Cargo.toml`/`Cargo.lock` and the README download links, then pushes a `chore(release): vX.Y.Z` commit;
3. builds the Windows installers and `SHA256SUMS.txt` from that commit;
4. tags it and publishes the GitHub release, which the in-app updater then offers.

`docs`, `chore`, `ci`, `test`, `refactor`, `style` and `build` commits do not release on their own. Release notes are generated from the commit subjects; to write them yourself, add `docs/releases/vX.Y.Z.md` in the PR that triggers the release. To force a release or a specific bump, run the workflow manually from the Actions tab.

## Project links

Report UXO bugs and propose UXO changes through the [UXO repository](https://github.com/bglglzd/uxo). Third-party attribution and dependency licenses are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
