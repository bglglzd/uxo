# Initial Nemotron performance probe

## Result

On the target development PC, Nemotron 3.5 ASR Streaming 0.6B Q8 processed audio faster than real time on CPU after warm-up. That supports UXO's CPU-first Windows default while leaving the RTX 4070 Ti available to a game.

These figures are an exploratory runtime measurement, not a UXO end-to-end benchmark and not evidence of transcription accuracy.

## Test context

- Date: 2026-08-28
- OS: Windows 11
- CPU: Intel Core i7-12700K, 12 cores / 20 threads
- Memory: 32 GB
- GPU: NVIDIA GeForce RTX 4070 Ti, 12 GB
- Model: [NVIDIA Nemotron 3.5 ASR Streaming 0.6B](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b), official Q8 GGUF
- Runtime: [NVIDIA NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp)
- Inputs: synthetic TTS utterances, 19.44 seconds in Russian and 15.93 seconds in English

No private microphone recording was used. The probe did not run through UXO's capture, VAD, text-cleanup, clipboard, or UI layers.

## Measurements

| Compute path | Mode                        |  Observed throughput | Notes                                                                            |
| ------------ | --------------------------- | -------------------: | -------------------------------------------------------------------------------- |
| CPU          | Offline, persistent process | 5.66–5.99× real time | A 19.44 s utterance corresponds to roughly 3.2–3.4 s of inference at this range. |
| CPU          | Streaming                   |      3.78× real time | Sustained model processing exceeded the incoming audio rate.                     |
| CUDA         | Offline                     |   164–171× real time | Very high isolated throughput, but it uses the same discrete GPU as a game.      |
| CUDA         | Streaming                   |     30.68× real time | Fastest isolated path; not selected as the shared-resource default.              |

The first CPU initialization/warm-up took approximately 6.58 seconds. Keeping the model session resident is therefore important: reloading it for every shortcut press would dominate short dictations even though steady-state processing is comfortably faster than real time.

## Interpretation

"3.78× real time" describes processing capacity, not the exact delay before the first word appears or the final text is pasted. Perceived latency also includes:

- audio chunk and look-ahead duration;
- model initialization and cache state;
- VAD endpointing;
- finalization and text cleanup;
- clipboard transaction and target-application response.

CUDA wins the isolated speed test by a large margin. CPU remains the current product default because the user's primary failure case is dictation while a game already drives the discrete GPU to 100%. The probe did **not** benchmark a running game, so resource-isolation benefits are a design inference that still needs direct coexistence testing.

## What this probe does not establish

- No WER or CER was calculated; synthetic audio cannot prove microphone accuracy.
- Only two utterances were used, so the range is not a statistically meaningful distribution.
- Noise, accents, code-switching, proper nouns, punctuation, and long-form stability were not evaluated.
- There are no cold-start, first-partial, finalization, or paste-latency percentiles from the UXO application.
- CPU utilization, power, temperatures, game frame time, and memory high-water marks were not recorded.
- The official runtime and UXO's `transcribe-cpp` integration are related native paths but not identical benchmark executables.

## Required end-to-end benchmark

Before a public release, collect a repeatable matrix with at least:

1. Russian and English human microphone recordings across quiet, fan-noise, and game-audio conditions.
2. Cold start, warm start, first partial, shortcut release to final text, and final text to paste latency.
3. WER/CER plus punctuation and named-entity error review.
4. CPU-only idle, CPU-only during a representative game, and opt-in GPU during the same game.
5. Process working set, model memory, queue age, dropped/coalesced frames, CPU load, GPU load, and game frame-time impact.
6. At least 30 runs per cell, reporting median, p95, and failures rather than a single best run.

Until that matrix exists, the current numbers justify the architecture experiment only; they should not be used as marketing performance claims.
