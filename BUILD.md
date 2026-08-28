# Building UXO

UXO's current release-engineering target is x64 Windows with CPU-only speech inference. The Whisper-family backend is linked statically; the ONNX backend uses an app-local, dynamically linked Microsoft ONNX Runtime. macOS and Linux build paths remain useful for development, but UXO has not yet qualified them for release.

## Common setup

Install:

- latest stable [Rust](https://rustup.rs/);
- [Bun](https://bun.sh/);
- the platform prerequisites for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

From the repository root, install JavaScript dependencies. The development VAD model is tracked at `src-tauri/resources/models/silero_vad_v4.onnx`:

```powershell
bun install
```

The VAD file is bundled as an application resource. ASR models are not stored in Git; the app downloads a selected model during onboarding.

Frontend-only checks do not require a native toolchain:

```powershell
bun run build
bun run lint
bun run check:translations
bun run format:check
```

## Windows x64: verified CPU-only build

### What this build contains

The Windows x64 Cargo target uses `transcribe-cpp` 0.2.x with `default-features = false`. It statically links the optimized Whisper CPU backend into `uxo.exe` and does not build Vulkan, CUDA, or dynamic ggml backend DLLs. ONNX models use Microsoft's official x64 CPU package for ONNX Runtime 1.24.2, linked dynamically and shipped beside the executable. A Vulkan SDK and CUDA Toolkit are therefore not required.

This is intentional: CPU inference keeps the discrete GPU available to a game and avoids native driver/backend packaging while the product is being stabilized.

### Prerequisites

Install Visual Studio or Visual Studio Build Tools with:

- Desktop development with C++;
- MSVC x64 build tools;
- a Windows 10 or 11 SDK;
- the Visual Studio CMake tools for Windows component.

Use the MSVC Rust target, not the GNU target:

```powershell
rustup default stable-x86_64-pc-windows-msvc
```

### Reliable PowerShell recipe

Run the following from the UXO repository root in a normal 64-bit PowerShell session. It discovers Visual Studio with `vswhere`, imports `vcvars64.bat`, downloads the [official Microsoft ONNX Runtime 1.24.2 CPU archive](https://github.com/microsoft/onnxruntime/releases/download/v1.24.2/onnxruntime-win-x64-1.24.2.zip), verifies its SHA-256 before extraction, locates the matching VC++ redistributable, pins Visual Studio's bundled CMake and Ninja, clears a stale native package build, and produces a runnable unbundled release directory.

```powershell
$ErrorActionPreference = 'Stop'
$buildMode = 'unbundled' # unbundled, installer, or dev

$repoRoot = (Get-Location).Path
if (-not (Test-Path (Join-Path $repoRoot 'src-tauri/Cargo.toml'))) {
  throw 'Run this command from the UXO repository root.'
}
if (-not $env:TMP) {
  throw 'TMP must be set for downloads, compiler, and Cargo temporary files.'
}

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw 'vswhere.exe was not found. Install Visual Studio C++ Build Tools.'
}

$vsRoot = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath
if (-not $vsRoot) {
  throw 'No Visual Studio installation with the x64 C++ toolchain was found.'
}

$vcvars = Join-Path $vsRoot 'VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path $vcvars)) {
  throw "vcvars64.bat was not found: $vcvars"
}
& cmd.exe /d /s /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match '^(?<name>[^=]+)=(?<value>.*)$') {
    Set-Item -LiteralPath "Env:$($Matches.name)" -Value $Matches.value
  }
}

$vsCmake = Join-Path $vsRoot 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$vsNinja = Join-Path $vsRoot 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe'
if (-not (Test-Path $vsCmake) -or -not (Test-Path $vsNinja)) {
  throw 'Visual Studio CMake or Ninja was not found. Add the CMake tools component.'
}

# Use Microsoft's official baseline CPU build rather than ort-sys's static archive.
$ortVersion = '1.24.2'
$ortSha256 = '8E3E9C826375352E29CB2614FE44F3D7A4B0FF7B8028AD7A456AF9D949A7E8B0'
$ortUrl = "https://github.com/microsoft/onnxruntime/releases/download/v$ortVersion/onnxruntime-win-x64-$ortVersion.zip"
$dependencyRoot = Join-Path $env:TMP 'uxo-native-dependencies'
$ortArchive = Join-Path $dependencyRoot "onnxruntime-win-x64-$ortVersion.zip"
$ortPartial = "$ortArchive.partial"
$ortExtractRoot = Join-Path $dependencyRoot "onnxruntime-$ortVersion-$($ortSha256.Substring(0, 12))"
$ortPackageRoot = Join-Path $ortExtractRoot "onnxruntime-win-x64-$ortVersion"
$ortLib = Join-Path $ortPackageRoot 'lib'

New-Item -ItemType Directory -Force $dependencyRoot | Out-Null
$cachedHash = if (Test-Path $ortArchive) {
  (Get-FileHash -LiteralPath $ortArchive -Algorithm SHA256).Hash.ToUpperInvariant()
}
if ($cachedHash -ne $ortSha256) {
  Remove-Item -LiteralPath $ortArchive -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ortPartial -Force -ErrorAction SilentlyContinue
  Invoke-WebRequest -Uri $ortUrl -OutFile $ortPartial
  $downloadHash = (Get-FileHash -LiteralPath $ortPartial -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($downloadHash -ne $ortSha256) {
    Remove-Item -LiteralPath $ortPartial -Force
    throw "ONNX Runtime archive SHA-256 mismatch: expected $ortSha256, got $downloadHash"
  }
  Move-Item -LiteralPath $ortPartial -Destination $ortArchive -Force
}

Expand-Archive -LiteralPath $ortArchive -DestinationPath $ortExtractRoot -Force
$ortDll = Join-Path $ortLib 'onnxruntime.dll'
$ortImportLibrary = Join-Path $ortLib 'onnxruntime.lib'
if (-not (Test-Path $ortDll) -or -not (Test-Path $ortImportLibrary)) {
  throw "The verified ONNX Runtime archive did not contain the expected lib directory: $ortLib"
}

# The CPU package must not acquire a DirectML/D3D12 dependency accidentally.
$ortDependencies = (& dumpbin.exe /nologo /dependents $ortDll | Out-String)
if ($LASTEXITCODE -ne 0) { throw 'dumpbin failed while auditing onnxruntime.dll.' }
foreach ($forbidden in @('directml.dll', 'd3d12.dll')) {
  if ($ortDependencies -match "(?im)^\s*$([regex]::Escape($forbidden))\s*$") {
    throw "The selected ONNX Runtime package unexpectedly imports $forbidden"
  }
}

# Stage the VC++ runtime from the exact Visual Studio toolset used for this build.
$redistVersionFile = Join-Path $vsRoot 'VC\Auxiliary\Build\Microsoft.VCRedistVersion.default.txt'
if (-not (Test-Path $redistVersionFile)) {
  throw "VC++ redistributable version file was not found: $redistVersionFile"
}
$redistVersion = (Get-Content -LiteralPath $redistVersionFile -Raw).Trim()
$redistArchRoot = Join-Path $vsRoot "VC\Redist\MSVC\$redistVersion\x64"
if (-not (Test-Path $redistArchRoot)) {
  throw "The x64 VC++ redistributable directory was not found: $redistArchRoot"
}
$crtRedist = Get-ChildItem $redistArchRoot -Directory -Filter 'Microsoft.VC*.CRT' |
  Sort-Object Name | Select-Object -Last 1
if (-not $crtRedist -or -not (Test-Path (Join-Path $crtRedist.FullName 'msvcp140.dll')) -or
    -not (Test-Path (Join-Path $crtRedist.FullName 'vcruntime140.dll'))) {
  throw "The x64 VC++ CRT redistributable is missing or incomplete under: $redistArchRoot"
}
$vcRedistDirs = $crtRedist.FullName

$savedEnv = @{
  LocalAppData = $env:LOCALAPPDATA
  Temp = $env:TEMP
  CMake = $env:CMAKE
  Generator = $env:CMAKE_GENERATOR
  MakeProgram = $env:CMAKE_MAKE_PROGRAM
  CMakeArgs = $env:CMAKE_ARGS
  OrtLibLocation = $env:ORT_LIB_LOCATION
  OrtPreferDynamicLink = $env:ORT_PREFER_DYNAMIC_LINK
  VcRedistDirs = $env:UXO_VC_REDIST_DIRS
  Path = $env:PATH
}

try {
  $env:CMAKE = $vsCmake
  $env:CMAKE_GENERATOR = 'Ninja'
  $env:CMAKE_MAKE_PROGRAM = $vsNinja
  $env:CMAKE_ARGS = '-DGGML_CCACHE=OFF'
  $env:ORT_LIB_LOCATION = $ortLib
  $env:ORT_PREFER_DYNAMIC_LINK = '1'
  $env:UXO_VC_REDIST_DIRS = $vcRedistDirs
  $env:PATH = "$ortLib;$(Split-Path $vsNinja);$env:PATH"

  # Keep TMP intact. transcribe-cpp-sys 0.2.x checks LOCALAPPDATA and TEMP,
  # but not TMP, when deciding whether to build through its NTFS junction.
  Remove-Item Env:LOCALAPPDATA -ErrorAction SilentlyContinue
  Remove-Item Env:TEMP -ErrorAction SilentlyContinue
  if (-not $env:TMP) {
    throw 'TMP must remain set for compiler and Cargo temporary files.'
  }

  # Remove only previously staged runtime DLLs. Cleaning uxo forces build.rs to
  # repopulate this directory; cleaning ort-sys prevents reuse of a static link.
  $runtimeStaging = Join-Path $repoRoot 'src-tauri\transcribe-libs'
  New-Item -ItemType Directory -Force $runtimeStaging | Out-Null
  Get-ChildItem $runtimeStaging -File -Filter '*.dll' -ErrorAction SilentlyContinue |
    Remove-Item -Force

  & cargo clean --manifest-path src-tauri/Cargo.toml -p transcribe-cpp-sys
  if ($LASTEXITCODE -ne 0) { throw 'cargo clean failed.' }
  & cargo clean --manifest-path src-tauri/Cargo.toml -p ort-sys
  if ($LASTEXITCODE -ne 0) { throw 'cargo clean for ort-sys failed.' }
  & cargo clean --manifest-path src-tauri/Cargo.toml -p uxo
  if ($LASTEXITCODE -ne 0) { throw 'cargo clean for uxo failed.' }

  switch ($buildMode) {
    'unbundled' { & bun run tauri build --no-bundle }
    'installer' { & bun run tauri build }
    'dev' { & bun run tauri dev }
    default { throw "Unknown build mode: $buildMode" }
  }
  if ($LASTEXITCODE -ne 0) { throw 'UXO native build failed.' }

  # A raw release executable does not install Tauri resources. Copy the staged
  # app-local runtime beside it; installers use the same staging automatically.
  if ($buildMode -ne 'dev' -and -not $env:CARGO_TARGET_DIR) {
    $releaseDir = Join-Path $repoRoot 'src-tauri\target\release'
    $releaseExe = Join-Path $releaseDir 'uxo.exe'
    if (-not (Test-Path $releaseExe)) { throw "Release executable was not found: $releaseExe" }

    # Remove app-local runtime files left by an older build before copying the
    # freshly staged CPU-only set. This prevents obsolete GPU/OpenMP DLLs from
    # surviving beside an otherwise clean executable.
    foreach ($pattern in @(
      'onnxruntime.dll', 'DirectML.dll', 'd3d12.dll', 'vcomp140.dll',
      'msvcp140*.dll', 'vcruntime140*.dll'
    )) {
      Get-ChildItem $releaseDir -File -Filter $pattern -ErrorAction SilentlyContinue |
        Remove-Item -Force
    }
    Get-ChildItem (Join-Path $repoRoot 'src-tauri\transcribe-libs') -File -Filter '*.dll' |
      Copy-Item -Destination $releaseDir -Force

    $uxoDependencies = (& dumpbin.exe /nologo /dependents $releaseExe | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'dumpbin failed while auditing uxo.exe.' }
    if ($uxoDependencies -notmatch '(?im)^\s*onnxruntime\.dll\s*$') {
      throw 'uxo.exe does not dynamically import the staged onnxruntime.dll.'
    }
    foreach ($forbidden in @('directml.dll', 'd3d12.dll', 'vcomp140.dll')) {
      if ($uxoDependencies -match "(?im)^\s*$([regex]::Escape($forbidden))\s*$") {
        throw "uxo.exe unexpectedly imports $forbidden"
      }
    }

    $stagedNames = Get-ChildItem (Join-Path $repoRoot 'src-tauri\transcribe-libs') -File |
      ForEach-Object { $_.Name.ToLowerInvariant() }
    foreach ($forbidden in @('directml.dll', 'd3d12.dll', 'vcomp140.dll')) {
      if ($stagedNames -contains $forbidden) {
        throw "The Windows runtime staging directory unexpectedly contains $forbidden"
      }
    }
  }
  elseif ($buildMode -ne 'dev') {
    Write-Warning 'CARGO_TARGET_DIR is set; copy transcribe-libs/*.dll beside the release uxo.exe and audit that executable manually.'
  }
}
finally {
  $env:LOCALAPPDATA = $savedEnv.LocalAppData
  $env:TEMP = $savedEnv.Temp
  $env:CMAKE = $savedEnv.CMake
  $env:CMAKE_GENERATOR = $savedEnv.Generator
  $env:CMAKE_MAKE_PROGRAM = $savedEnv.MakeProgram
  $env:CMAKE_ARGS = $savedEnv.CMakeArgs
  $env:ORT_LIB_LOCATION = $savedEnv.OrtLibLocation
  $env:ORT_PREFER_DYNAMIC_LINK = $savedEnv.OrtPreferDynamicLink
  $env:UXO_VC_REDIST_DIRS = $savedEnv.VcRedistDirs
  $env:PATH = $savedEnv.Path
}
```

The default `unbundled` mode writes the executable and required app-local DLLs to `src-tauri/target/release/`. Set `$buildMode = 'dev'` for `tauri dev`, or `$buildMode = 'installer'` for an unsigned installer. Code signing and a production update channel are not configured yet, so publish these bundles only as clearly labeled Preview assets after completing the package, dependency, and checksum audits below.

With a custom `CARGO_TARGET_DIR`, the recipe cannot infer every possible target/profile layout. Copy the DLLs from `src-tauri/transcribe-libs/` beside the generated `uxo.exe`, then run the same `dumpbin /dependents` audit against that executable before treating the directory as self-contained.

### Why ONNX Runtime is dynamic and still CPU-only

`ORT_LIB_LOCATION` points `ort-sys` at the verified package's `lib` directory, while `ORT_PREFER_DYNAMIC_LINK=1` selects its import library instead of embedding the dependency's default static ONNX Runtime archive. UXO's build script stages `onnxruntime.dll` in `src-tauri/transcribe-libs/`; the Windows Tauri configuration places it beside `uxo.exe` in an installer. The recipe performs the equivalent copy for the raw `--no-bundle` release directory.

`UXO_VC_REDIST_DIRS` supplies the CRT redistributable directory from the same Visual Studio toolset used to compile UXO. The build script stages the required `msvcp140*` and `vcruntime140*` DLLs beside ONNX Runtime, so a local installer does not depend on a separately installed current VC++ redistributable. The verified Windows CPU posture builds ggml with OpenMP disabled, so `vcomp140.dll` is not a runtime requirement.

Dynamic linkage here does not enable GPU inference. UXO enables `transcribe-rs`'s `onnx` feature but not `ort-directml`, and the selected Microsoft archive is the CPU package. Consequently, the distributable x64 executable imports `onnxruntime.dll`, not `DirectML.dll` or `d3d12.dll`. The recipe checks both the downloaded runtime and the final executable with `dumpbin`; an unexpected DirectML or D3D12 import stops the build handoff instead of silently weakening the CPU-only guarantee.

### Why the environment workaround is needed

`transcribe-cpp-sys` 0.2.x normally creates a short NTFS junction under `%LOCALAPPDATA%\tcs` (or `%TEMP%\tcs`) and asks CMake to build through it. That protects deeply nested Vulkan builds from Windows `MAX_PATH` limits.

On the verified Windows toolchain, CMake compiler probes executed through that junction could fail before compilation with missing `build.ninja`, `Makefile`, or `VCTargetsPath.lastbuildstate` files. UXO's Windows backend is CPU-static and does not have Vulkan's deeply nested shader-generator build, so it can safely use Cargo's normal `OUT_DIR` instead.

Temporarily removing `LOCALAPPDATA` and `TEMP` deliberately makes the 0.2.x build script bypass its junction. `TMP` is left intact so Cargo, MSVC, and other tools still have a temporary directory. The recipe restores both removed variables even when the build fails.

Pinning Visual Studio's bundled CMake and Ninja is equally important. A MinGW/WinLibs CMake found earlier on `PATH` produced incompatible compiler-probe behavior when combined with MSVC. `-DGGML_CCACHE=OFF` removes another unnecessary compiler-launcher discovery path on Windows.

### Windows troubleshooting

#### The build still uses the wrong generator

Start a fresh PowerShell and run the complete recipe. A successful native configure should identify the Ninja generator and MSVC compiler. Do not reuse a failed `transcribe-cpp-sys` CMake tree without the targeted `cargo clean` step.

#### Path-length errors without the junction

The static CPU build is much shallower than a Vulkan build. If the checkout is still deeply nested, move it to a short path such as `C:\src\uxo`, or set a short Cargo target directory for the build session:

```powershell
$env:CARGO_TARGET_DIR = 'C:\uxo-target'
```

Build artifacts will then be written there instead of under `src-tauri/target`. Do not set a global `CARGO_TARGET_DIR` unless redirecting every Rust project's artifacts is intentional.

#### `cl.exe` is not found

The `vcvars64.bat` import did not succeed or the Visual Studio C++ workload is missing. Confirm that `$vcvars` exists and that `Get-Command cl.exe` resolves after the import section.

#### The app cannot find the VAD model

Confirm that the tracked resource exists before building:

```text
src-tauri/resources/models/silero_vad_v4.onnx
```

## macOS development

Install Xcode command-line tools, Rust, Bun, and the Tauri prerequisites:

```bash
xcode-select --install
bun install
bun run tauri dev
```

macOS builds retain the Metal backend. Intel macOS does not have a prebuilt ONNX Runtime for this dependency set; install it with Homebrew and point the build at its libraries:

```bash
brew install onnxruntime
ORT_LIB_LOCATION="$(brew --prefix onnxruntime)/lib" \
  ORT_PREFER_DYNAMIC_LINK=1 \
  bun run tauri build
```

Local ad-hoc rebuilds can invalidate an existing Accessibility grant. If UXO remains stuck waiting for permission, quit the app, reset only its Accessibility entry, reopen it, and grant access again:

```bash
tccutil reset Accessibility org.gardar.uxo
open /Applications/UXO.app
```

This path has not received the same UXO validation as Windows.

## Linux development

Linux currently uses GTK/WebKit, layer-shell, OpenBLAS, and the Vulkan backend. On Ubuntu or Debian, install at least:

```bash
sudo apt update
sudo apt install build-essential clang libclang-dev libevdev-dev \
  libasound2-dev pkg-config libssl-dev libvulkan-dev glslc \
  spirv-headers glslang-tools libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libgtk-layer-shell0 \
  libgtk-layer-shell-dev libopenblas-dev patchelf cmake ninja-build
```

Then:

```bash
bun install
bun run tauri dev
# Or build one practical package while iterating:
bun run tauri build -- --bundles deb
```

Bundled runtime libraries are installed under `/usr/lib/UXO`. Wayland shortcut and paste behavior varies by compositor, and the recording overlay is disabled by default on Linux. This target is not currently a UXO release target.

## Verification before committing

Run the portable checks first:

```powershell
bun run build
bun run lint
bun run check:translations
bun run format:check
```

For a native Windows candidate, run the complete recipe above with `$buildMode = 'installer'`. If Rust tests are required, run `cargo test --manifest-path src-tauri/Cargo.toml` inside the recipe's `try` block after the three targeted `cargo clean` commands; that keeps the test build under the same ONNX Runtime, Visual Studio CMake/Ninja, and temporary-variable environment. Running a native command later in an arbitrary shell is not equivalent to the verified recipe.
