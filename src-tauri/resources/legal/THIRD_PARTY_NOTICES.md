# Third-party notices

This document records the software, native runtimes, and model artifacts relevant to the UXO v0.1.1 Windows x64 release. It supplements the license texts shipped in `resources/legal`; it does not replace the terms of any dependency or separately downloaded model.

## UXO application provenance

UXO is maintained by bglglzd and UXO contributors under the MIT License. It
contains portions of MIT-licensed work by CJ Pais and other contributors. The
original CJ Pais copyright notice is preserved in this repository's `LICENSE`
and the installer's `UXO_LICENSE.txt`.

UXO has its own name and artwork. References that remain in dependency names,
source locations, or model repositories identify their actual technical source
and do not imply affiliation or endorsement.

## Files bundled in the Windows x64 release

The v0.1.1 Windows x64 installer contains the UXO application, its embedded web interface, application icons and audio feedback assets, and these material native/model components:

| Component                               | Bundled files or artifact                                                                                                                                                        | License / notice                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Silero VAD                              | `resources/models/silero_vad_v4.onnx`                                                                                                                                            | MIT; source and checksum below; full text in `SILERO_VAD_LICENSE.txt`                                                             |
| ONNX Runtime 1.24.2 CPU build           | `onnxruntime.dll`                                                                                                                                                                | MIT; full text in `ONNX_RUNTIME_LICENSE.txt`; dependency notices in `ONNX_RUNTIME_THIRD_PARTY_NOTICES.txt`                        |
| `transcribe-rs` 0.3.11                  | Statically linked ONNX speech-engine integration                                                                                                                                 | MIT; full text in `TRANSCRIBE_RS_LICENSE.txt`                                                                                     |
| transcribe.cpp / `transcribe-cpp` 0.2.2 | Statically linked speech inference code                                                                                                                                          | MIT; full texts in `TRANSCRIBE_CPP_LICENSE.txt`, `TRANSCRIBE_CPP_SYS_LICENSE.txt`, and `TRANSCRIBE_CPP_RUST_BINDINGS_LICENSE.txt` |
| GGML                                    | Statically linked inference code through transcribe.cpp                                                                                                                          | MIT; full text in `GGML_LICENSE.txt`                                                                                              |
| miniz                                   | Statically linked through transcribe.cpp                                                                                                                                         | MIT-style license; full text in `MINIZ_LICENSE.txt`                                                                               |
| Microsoft Visual C++ runtime            | `msvcp140.dll`, `msvcp140_1.dll`, `msvcp140_2.dll`, `msvcp140_atomic_wait.dll`, `msvcp140_codecvt_ids.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`, `vcruntime140_threads.dll` | Microsoft Visual Studio licensing terms apply to the redistributable runtime components                                           |

The Rust crates and JavaScript packages used to build UXO are pinned in `Cargo.lock` and `bun.lock`. Their respective licenses continue to apply. This human-readable summary focuses on material components shipped outside the application executable and major native code linked into it; the lockfiles remain the authoritative dependency inventory for the source build.

### Silero VAD provenance

- Project: [snakers4/silero-vad](https://github.com/snakers4/silero-vad)
- Bundled artifact: `src-tauri/resources/models/silero_vad_v4.onnx`
- SHA-256: `A35EBF52FD3CE5F1469B2A36158DBA761BC47B973EA3382B3186CA15B1F5AF28`
- License: MIT, Copyright (c) 2020-present Silero Team

## Speech-recognition model weights are downloaded separately

The Windows installer does **not** bundle the user-selectable speech-recognition model weights. UXO downloads a model only after the user chooses one. Each checkpoint remains governed by its own model card, license, acceptable-use terms, and attribution requirements; UXO's MIT License does not relicense those weights.

The recommended model in v0.1.1 is pinned as follows:

| Field                                      | Value                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Converted artifact repository              | [`handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf`](https://huggingface.co/handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf) |
| Immutable revision                         | `6d44e540bc31b0de1dbe174a3cea87f53a7f22fb`                                                                                          |
| Base model                                 | [`nvidia/nemotron-3.5-asr-streaming-0.6b`](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b)                           |
| License recorded by the model repositories | Open Model Data and Weights License 1.1 (`openmdw-1.1`)                                                                             |
| Default artifact                           | `nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf`                                                                                         |
| Default artifact SHA-256                   | `b94545b313b3223fda7b2857a52681da813935c2127643d1e9ff0c23d988089c`                                                                  |

All available Nemotron quantizations are pinned to that immutable repository revision and have individual SHA-256 checksums in `src-tauri/src/catalog/catalog.json`. Download availability depends on the upstream host. Any redistribution of a downloaded checkpoint must preserve its provenance and comply with OpenMDW 1.1 and any accompanying model-card terms.

The catalog also offers Whisper, Parakeet, Canary, Moonshine, SenseVoice, GigaAM, Cohere, and other model families under varying terms. The catalog's short `license` field is informational metadata, not a substitute for reviewing the selected artifact's license before redistribution.

## Optional online services

Local transcription does not require a transcription service. Optional post-processing can connect to a provider selected and configured by the user. That provider's service terms, privacy policy, and data-handling practices apply whenever the feature is enabled.

## Included license files

The Windows package includes these files under `resources/legal`:

- `UXO_LICENSE.txt`
- `THIRD_PARTY_NOTICES.md`
- `SILERO_VAD_LICENSE.txt`
- `ONNX_RUNTIME_LICENSE.txt`
- `ONNX_RUNTIME_THIRD_PARTY_NOTICES.txt`
- `TRANSCRIBE_RS_LICENSE.txt`
- `TRANSCRIBE_CPP_LICENSE.txt`
- `TRANSCRIBE_CPP_SYS_LICENSE.txt`
- `TRANSCRIBE_CPP_RUST_BINDINGS_LICENSE.txt`
- `GGML_LICENSE.txt`
- `MINIZ_LICENSE.txt`
