# UXO architecture

## Scope and priorities

UXO is a Windows-first tray dictation application built with Rust, Tauri, React, and local speech-recognition runtimes. This document describes the current development architecture, not a production-readiness claim.

The design priorities are:

1. keep dictation available while a game saturates the discrete GPU;
2. preserve Russian and other Unicode text regardless of keyboard layout;
3. keep core audio capture and ASR local;
4. minimize perceived latency without sacrificing final-text quality;
5. retain a small native resident footprint and a clear recovery path when inference fails.

## Components

| Layer         | Implementation                 | Responsibility                                                         |
| ------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Desktop shell | Tauri 2                        | Single-instance lifecycle, tray, windows, autostart, global commands   |
| Settings UI   | React, TypeScript, Zustand     | Onboarding, shortcuts, devices, models, language, history, diagnostics |
| Native core   | Rust                           | Coordination, settings, model lifecycle, history, clipboard, logging   |
| Audio         | `cpal`, resampling, Silero VAD | Device selection, mono capture, 16 kHz frames, silence filtering       |
| GGML/GGUF ASR | `transcribe-cpp` 0.2           | Whisper-family and native streaming model sessions                     |
| ONNX ASR      | `transcribe-rs` 0.3            | Parakeet, Moonshine, SenseVoice, GigaAM, Canary, and related engines   |
| Text delivery | Windows clipboard transaction  | UTF-16 paste into the application that retained focus                  |

The backend is organized around managers under `src-tauri/src/managers/`. Tauri commands carry settings actions from the frontend; backend events report model, recording, streaming text, history, and overlay state.

## Dictation data flow

```text
global shortcut / CLI signal
          |
          v
TranscriptionCoordinator ---- cancel / duplicate-input control
          |
          v
AudioRecordingManager -> device capture -> resample to 16 kHz mono -> VAD
          |                                                        |
          | streaming model                                       | batch model
          v                                                        v
StreamRouter -> worker -> Session::stream/feed/finalize      buffered samples
          |                                                        |
          +------------------------+-------------------------------+
                                   v
                       TranscriptionManager
                                   |
                    cleanup / dictionary / optional LLM
                                   |
                                   v
                reliable UTF-16 clipboard transaction
                                   |
                                   v
                         focused application
```

The tray and overlay expose `idle`, `recording`, and `transcribing` states. The overlay must not become the paste target; focus remains with the application in which the user started dictation.

## Streaming lifecycle

Nemotron 3.5 uses the native `transcribe-cpp` streaming API already integrated in the application:

1. `TranscriptionManager` opens a streaming session and a worker.
2. The audio callback forwards 16 kHz frames through `StreamRouter`.
3. The model reuses encoder state while emitting live partial text.
4. Releasing the shortcut closes the route and asks the worker to finalize.
5. Final text enters the same cleanup and paste pipeline as batch transcription.

Non-streaming models keep the established buffer-then-transcribe path. This lets UXO retain Whisper or accuracy-oriented Parakeet variants without forcing every engine into an artificial streaming abstraction.

### Backpressure caveat

`StreamRouter` currently uses an unbounded standard MPSC channel and copies each frame. If inference falls behind capture for a long session, latency and memory can grow instead of applying a defined overload policy. Before production hardening, replace this with a bounded queue or ring buffer and choose an observable policy such as backpressure, coalescing, or controlled cancellation. Silent arbitrary frame loss is not acceptable for ASR quality.

## CPU-first Windows policy

The x64 Windows build currently compiles `transcribe-cpp` as a static CPU backend. Windows settings also default to CPU. This is a packaging and resource-isolation decision, not a statement that GPU inference is slow:

- a game can already occupy nearly all discrete-GPU compute and memory bandwidth;
- competing CUDA/Vulkan workloads can create latency spikes or fail to allocate resources;
- the target desktop CPU has enough sustained throughput for short dictation after model warm-up;
- a CPU-only native module reduces driver and backend packaging failure modes during the prototype stage.

Future acceleration should be explicit and measured. A useful order is CPU by default, integrated GPU where supported, then discrete GPU as an opt-in "maximum speed" mode with load/failure fallback. Backend selection must remain deterministic and visible in diagnostics.

## Language and paste correctness

For a new profile, UXO derives an explicit base language from the OS locale when possible (for example, `ru-RU` becomes `ru`). Users can still select another supported language or automatic detection. Explicit conditioning is preferred for monolingual dictation because it removes avoidable language-identification uncertainty.

On Windows, reliable paste uses `CF_UNICODETEXT`, not per-character virtual-key typing. The implementation creates a hidden message-only clipboard owner, supports delayed rendering, snapshots and restores existing clipboard formats, and uses a clipboard-sequence guard so it does not overwrite a user's newer clipboard contents. Consequently, Russian text does not depend on whether the target application's active keyboard layout is English or Russian.

The legacy typing/clipboard paths remain fallbacks for incompatible applications. Failures should be reported in diagnostics rather than silently switching to layout-dependent typing.

## Privacy and persistence

The core path is local:

- microphone samples go to local VAD and ASR;
- model files are downloaded once and loaded locally;
- transcription history and retained audio, when enabled, stay in the app data directory.

Network boundaries must remain explicit. Model download is a network operation. Optional remote LLM post-processing sends transcript text outside the device only when configured and invoked. API keys belong in the existing secret-storage abstraction and must never enter logs or exported diagnostics.

## Model strategy

| Use case                                            | Preferred family                   | Reason                                                                        |
| --------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| Russian/English live dictation                      | Nemotron 3.5 ASR Streaming 0.6B Q8 | Native cache-aware streaming, multilingual language conditioning, punctuation |
| Accuracy-oriented completed utterances              | Parakeet TDT 0.6B v3               | Strong multilingual batch option; not the same true streaming path            |
| Broad compatibility, translation, custom fine-tunes | Whisper                            | Mature model ecosystem and broad language coverage                            |
| Russian specialist experiments                      | GigaAM                             | Useful comparison candidate; must be benchmarked in the same local harness    |

Model choice is a product policy layered over a general catalog. Every entry must carry immutable revision and checksum metadata, and the UI still needs complete license disclosure before downloads.

## Release-hardening work

- Bound the streaming audio queue and instrument queue age, partial latency, and final latency.
- Add repeatable Russian and English microphone corpora and report WER/CER, not subjective examples.
- Measure game coexistence under real GPU and CPU load, including process priority and thermal throttling.
- Stress-test clipboard restore behavior across games, terminals, browsers, Office, Electron apps, and elevated windows.
- Finish independent model hosting, license presentation, installer signing, and updater signing.
- Add crash recovery, corrupted-model recovery, and long-session soak tests.
