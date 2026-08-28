# Contributing Translations to UXO

Translations live in `src/i18n/locales/<language-code>/translation.json`; English is the source locale.

## Add or update a language

1. Copy `src/i18n/locales/en/translation.json` into the target language directory.
2. Translate values only. Keep JSON keys and every `{{variable}}` unchanged.
3. Register a new locale in `src/i18n/languages.ts`.
4. Run `bun run check:translations` and `bun run format:check`.
5. Open the app and inspect longer labels, right-to-left layout where applicable, and accelerator/model descriptions.

Use natural, concise language. Keep technical product and engine names such as UXO, transcribe.cpp, Nemotron, Parakeet, Whisper, and OpenAI unchanged. Never include real transcription content in screenshots or fixtures.

When English adds a key, every locale must contain it before the translation check will pass. A temporary English fallback is preferable to silently omitting a control, but it should be clearly tracked for native review.
