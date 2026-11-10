# Dependency maintenance

Run the same checks used by the dependency-audit workflow:

```sh
bun install --frozen-lockfile
bun audit
cargo install cargo-audit --locked --version 0.22.2
cargo audit --file src-tauri/Cargo.lock
```

The workflow runs when dependency declarations, lockfiles or this policy change.
It fails on known vulnerabilities. It does not suppress advisory IDs or treat a
clean audit as proof that every dependency is secure.

## Frontend tooling

The project and CI retain Bun 1.3.13 and the lockfile format supported by the
pinned bun2nix generator. ESLint 10 uses the existing flat configuration and
requires Node 20.19+, 22.13+, or 24+.

The minimatch override selects version 11 to address
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
ESLint 10 and typescript-estree both use the modern minimatch API; the old
ESLint 9/minimatch 3 API is no longer in the graph. Remove the override when
both upstream tools declare patched versions themselves.

Commit the generated `.nix/bun.nix` and `.nix/bun-lock-hash` with `bun.lock`.
`bun run check:nix-deps` checks the tracked hash on all platforms. Linux CI also
regenerates the manifest with bun2nix 2.0.8 and compares it byte-for-byte before
installation, so a postinstall regeneration cannot hide stale committed data.

Zod was an unused direct dependency and has been removed. No application schema
was migrated to a different validation API.

## Native package compatibility

Tauri's Rust crates and installed JavaScript API/plugins must share major/minor
versions. `bun run check:tauri-versions` checks the actual installed package
versions against Cargo.lock in frontend CI, before a native installer build.
Tauri 2.12 and opener 2.7 are synchronized across both graphs. This check does
not replace the full native build, installer and runtime acceptance checks.

## History storage

SQLite is bundled through rusqlite 0.41, which includes the patched SQLite 3.54
line for [RUSTSEC-2026-0459](https://rustsec.org/advisories/RUSTSEC-2026-0459.html).
The former migration wrapper required an older rusqlite and prevented this
upgrade. The four existing SQL migrations now run in one SQLite transaction,
with the same `user_version` values and legacy SQLx migration tracking.
Tests cover every previous schema, existing recordings, repeat opening,
transaction rollback, file reopening, and refusal to modify newer schemas.

## Remaining upstream informational warnings

As of November 10, 2026, cargo-audit still reports informational maintenance and
soundness warnings in the platform dependency graph. They remain visible in its
output and need separate upstream work:

- GTK3's glib 0.18 has
  [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
  Tauri's GTK3 dependency cannot use glib 0.20 as a compatible patch. glib is
  absent from the Windows dependency tree. Linux is a development path, not a
  qualified release target; this warning remains relevant to Linux developers.
- The old phf generator uses rand 0.7, for which no compatible patched release
  exists for [RUSTSEC-2026-0097](https://rustsec.org/advisories/RUSTSEC-2026-0097.html).
  This is a build-time code generator; it is not the app's randomness provider.
- Some transitive crates are marked unmaintained, including GTK layer-shell,
  bincode, fxhash, paste, pin-utils, proc-macro-error and older zbus types.
  Replacing their parent libraries requires separate compatibility work.

These warnings are not claimed fixed. Dependency updates must also pass the
frontend checks, Windows native tests and relevant installation/runtime checks.
