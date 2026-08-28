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

## Project links

Report UXO bugs and propose UXO changes through the [UXO repository](https://github.com/bglglzd/uxo). Third-party attribution and dependency licenses are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
