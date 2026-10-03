//! In-app updates from GitHub Releases.
//!
//! Flow: [`check_for_update`] lists published releases newer than the running
//! version and returns the notes of every one of them, so the user can read
//! what changed before anything is downloaded. [`download_update`] streams the
//! installer to a temporary file, verifying its SHA-256 against the release's
//! `SHA256SUMS.txt` while downloading. [`install_update`] starts the verified
//! installer in passive update mode with relaunch (`/P /UPDATE /R`, the flags
//! of UXO's NSIS template) and exits so the installer can replace the files.
//!
//! Only the Windows NSIS installer can be applied in place. Other platforms and
//! portable installs still get the notes and a link to the release page.

use futures_util::StreamExt;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const HTTP_API_TIMEOUT: Duration = Duration::from_secs(30);
const DOWNLOAD_STALL_TIMEOUT: Duration = Duration::from_secs(60);
/// Installers are tens of megabytes; anything far larger is not ours.
const MAX_INSTALLER_BYTES: u64 = 1024 * 1024 * 1024;
const CHECKSUMS_ASSET: &str = "SHA256SUMS.txt";
/// Release notes are shown in full for this many newer versions.
const MAX_RELEASES_LISTED: usize = 20;

pub const DOWNLOAD_PROGRESS_EVENT: &str = "update-download-progress";

/// Why an update can be read about but not installed from inside the app.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum InstallBlocker {
    /// Portable installs live next to their data; the installer would put a
    /// second copy in the user's profile instead of updating this one.
    Portable,
    /// No in-place installer for this OS/architecture.
    UnsupportedPlatform,
    /// The release has no installer or no checksum for it.
    MissingAsset,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct ReleaseNotes {
    pub version: String,
    pub name: String,
    pub published_at: Option<String>,
    pub body: String,
    pub prerelease: bool,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    /// Every published release newer than the running one, newest first.
    pub releases: Vec<ReleaseNotes>,
    pub release_url: String,
    pub installer_name: Option<String>,
    pub download_size: Option<f64>,
    pub install_blocker: Option<InstallBlocker>,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct UpdateDownloadProgress {
    pub downloaded: f64,
    pub total: Option<f64>,
}

#[derive(Debug, Clone)]
struct PendingUpdate {
    version: String,
    installer_name: String,
    installer_url: String,
    checksums_url: String,
    downloaded_path: Option<PathBuf>,
}

#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<PendingUpdate>>,
    busy: Mutex<bool>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    html_url: String,
    draft: bool,
    prerelease: bool,
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

/// `owner/repo` from the crate's repository URL.
fn github_repo() -> &'static str {
    env!("CARGO_PKG_REPOSITORY")
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .trim_start_matches("https://github.com/")
}

fn parse_version(tag: &str) -> Option<semver::Version> {
    semver::Version::parse(tag.trim().trim_start_matches(['v', 'V'])).ok()
}

/// Installer file suffix for this platform, if UXO can update in place here.
fn installer_suffix() -> Option<&'static str> {
    if cfg!(all(windows, target_arch = "x86_64")) {
        Some("_x64-setup.exe")
    } else if cfg!(all(windows, target_arch = "aarch64")) {
        Some("_arm64-setup.exe")
    } else {
        None
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .user_agent(concat!("UXO/", env!("CARGO_PKG_VERSION")))
        .https_only(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))
}

fn is_github_url(url: &str) -> bool {
    url.starts_with("https://github.com/")
        || url.starts_with("https://api.github.com/")
        || url.starts_with("https://objects.githubusercontent.com/")
}

/// Newer published releases, newest first.
fn newer_releases(
    releases: Vec<GithubRelease>,
    current: &semver::Version,
) -> Vec<(semver::Version, GithubRelease)> {
    let mut newer: Vec<_> = releases
        .into_iter()
        .filter(|release| !release.draft)
        .filter_map(|release| Some((parse_version(&release.tag_name)?, release)))
        .filter(|(version, _)| version > current)
        .collect();
    newer.sort_by(|a, b| b.0.cmp(&a.0));
    newer
}

/// Expected hash for `file_name` from a `sha256sum`-style manifest
/// (`<hex>  <name>` or `<hex> *<name>`).
fn checksum_for(manifest: &str, file_name: &str) -> Option<String> {
    manifest.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (name == file_name && hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()))
            .then(|| hash.to_ascii_lowercase())
    })
}

/// Checks GitHub Releases for a version newer than the running one.
#[tauri::command]
#[specta::specta]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let current = parse_version(env!("CARGO_PKG_VERSION"))
        .ok_or_else(|| "Invalid application version".to_string())?;
    let url = format!(
        "https://api.github.com/repos/{}/releases?per_page=50",
        github_repo()
    );

    let response = http_client()?
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .timeout(HTTP_API_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Failed to reach GitHub: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("GitHub returned HTTP {}", response.status()));
    }
    let releases: Vec<GithubRelease> = response
        .json()
        .await
        .map_err(|e| format!("Unexpected GitHub response: {e}"))?;

    let newer = newer_releases(releases, &current);
    let state = app.state::<UpdaterState>();
    let Some((latest_version, latest)) = newer.first() else {
        *state.pending.lock().unwrap_or_else(|e| e.into_inner()) = None;
        return Ok(None);
    };

    let installer = installer_suffix().and_then(|suffix| {
        latest
            .assets
            .iter()
            .find(|asset| asset.name.ends_with(suffix))
    });
    let checksums = latest
        .assets
        .iter()
        .find(|asset| asset.name == CHECKSUMS_ASSET);

    let install_blocker = if crate::portable::is_portable() {
        Some(InstallBlocker::Portable)
    } else if installer_suffix().is_none() {
        Some(InstallBlocker::UnsupportedPlatform)
    } else if installer.is_none() || checksums.is_none() {
        Some(InstallBlocker::MissingAsset)
    } else {
        None
    };

    let pending = match (installer, checksums, install_blocker) {
        (Some(installer), Some(checksums), None)
            if is_github_url(&installer.browser_download_url)
                && is_github_url(&checksums.browser_download_url) =>
        {
            Some(PendingUpdate {
                version: latest_version.to_string(),
                installer_name: installer.name.clone(),
                installer_url: installer.browser_download_url.clone(),
                checksums_url: checksums.browser_download_url.clone(),
                downloaded_path: None,
            })
        }
        _ => None,
    };
    let install_blocker = match (&pending, install_blocker) {
        (None, None) => Some(InstallBlocker::MissingAsset),
        (_, blocker) => blocker,
    };

    {
        let mut slot = state.pending.lock().unwrap_or_else(|e| e.into_inner());
        // Keep an already verified download of the same version.
        let keep_existing = matches!(
            (&*slot, &pending),
            (Some(old), Some(new)) if old.version == new.version && old.downloaded_path.is_some()
        );
        if !keep_existing {
            *slot = pending;
        }
    }

    let info = UpdateInfo {
        current_version: current.to_string(),
        latest_version: latest_version.to_string(),
        release_url: latest.html_url.clone(),
        installer_name: installer.map(|asset| asset.name.clone()),
        download_size: installer.map(|asset| asset.size as f64),
        install_blocker,
        releases: newer
            .iter()
            .take(MAX_RELEASES_LISTED)
            .map(|(version, release)| ReleaseNotes {
                version: version.to_string(),
                name: release
                    .name
                    .clone()
                    .filter(|name| !name.trim().is_empty())
                    .unwrap_or_else(|| release.tag_name.clone()),
                published_at: release.published_at.clone(),
                body: release.body.clone().unwrap_or_default(),
                prerelease: release.prerelease,
                url: release.html_url.clone(),
            })
            .collect(),
    };
    info!(
        "Update available: {} -> {} ({} newer release(s))",
        info.current_version,
        info.latest_version,
        newer.len()
    );
    Ok(Some(info))
}

struct BusyGuard<'a>(&'a Mutex<bool>);

impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = false;
    }
}

/// Downloads the installer found by the last [`check_for_update`] and verifies
/// its SHA-256. Emits [`DOWNLOAD_PROGRESS_EVENT`] while downloading.
#[tauri::command]
#[specta::specta]
pub async fn download_update(app: AppHandle) -> Result<(), String> {
    let state = app.state::<UpdaterState>();
    {
        let mut busy = state.busy.lock().unwrap_or_else(|e| e.into_inner());
        if *busy {
            return Err("An update download is already in progress".to_string());
        }
        *busy = true;
    }
    let _busy = BusyGuard(&state.busy);

    let pending = state
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or_else(|| "No installable update. Check for updates first.".to_string())?;
    if pending
        .downloaded_path
        .as_ref()
        .is_some_and(|path| path.exists())
    {
        return Ok(());
    }

    let client = http_client()?;

    let manifest = client
        .get(&pending.checksums_url)
        .timeout(HTTP_API_TIMEOUT)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| format!("Failed to download checksums: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Failed to read checksums: {e}"))?;
    let expected = checksum_for(&manifest, &pending.installer_name)
        .ok_or_else(|| format!("{CHECKSUMS_ASSET} has no entry for the installer"))?;

    let dir = std::env::temp_dir().join("uxo-update");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {dir:?}: {e}"))?;
    let final_path = dir.join(&pending.installer_name);
    let part_path = dir.join(format!("{}.part", pending.installer_name));

    let response = client
        .get(&pending.installer_url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| format!("Failed to download the update: {e}"))?;
    let total = response.content_length();
    if total.is_some_and(|total| total > MAX_INSTALLER_BYTES) {
        return Err("The update installer is unexpectedly large".to_string());
    }

    let mut file = std::fs::File::create(&part_path)
        .map_err(|e| format!("Failed to create {part_path:?}: {e}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_emitted: u64 = 0;
    let mut stream = response.bytes_stream();

    let result: Result<(), String> = async {
        loop {
            let chunk = tokio::time::timeout(DOWNLOAD_STALL_TIMEOUT, stream.next())
                .await
                .map_err(|_| "The download stalled".to_string())?;
            let Some(chunk) = chunk else { break };
            let chunk = chunk.map_err(|e| format!("Download interrupted: {e}"))?;
            downloaded += chunk.len() as u64;
            if downloaded > MAX_INSTALLER_BYTES {
                return Err("The update installer is unexpectedly large".to_string());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write the update: {e}"))?;
            // Throttle progress events to roughly every 256 KiB.
            if downloaded - last_emitted >= 256 * 1024 {
                last_emitted = downloaded;
                let _ = app.emit(
                    DOWNLOAD_PROGRESS_EVENT,
                    UpdateDownloadProgress {
                        downloaded: downloaded as f64,
                        total: total.map(|t| t as f64),
                    },
                );
            }
        }
        file.flush()
            .map_err(|e| format!("Failed to write the update: {e}"))?;
        Ok(())
    }
    .await;
    drop(file);

    if let Err(error) = result {
        let _ = std::fs::remove_file(&part_path);
        return Err(error);
    }

    let actual = format!("{:x}", hasher.finalize());
    if actual != expected {
        let _ = std::fs::remove_file(&part_path);
        warn!(
            "Update checksum mismatch for {}: expected {}, got {}",
            pending.installer_name, expected, actual
        );
        return Err("The downloaded update failed its integrity check".to_string());
    }

    let _ = std::fs::remove_file(&final_path);
    std::fs::rename(&part_path, &final_path)
        .map_err(|e| format!("Failed to store the update: {e}"))?;
    let _ = app.emit(
        DOWNLOAD_PROGRESS_EVENT,
        UpdateDownloadProgress {
            downloaded: downloaded as f64,
            total: Some(downloaded as f64),
        },
    );

    info!(
        "Downloaded and verified UXO {} ({} bytes)",
        pending.version, downloaded
    );
    if let Some(slot) = state
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_mut()
        .filter(|slot| slot.version == pending.version)
    {
        slot.downloaded_path = Some(final_path);
    }
    Ok(())
}

/// Starts the verified installer in passive update mode and quits UXO. The
/// installer relaunches UXO when it finishes.
#[tauri::command]
#[specta::specta]
pub fn install_update(app: AppHandle) -> Result<(), String> {
    let path = app
        .state::<UpdaterState>()
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .and_then(|pending| pending.downloaded_path.clone())
        .filter(|path| path.exists())
        .ok_or_else(|| "The update has not been downloaded yet".to_string())?;

    if installer_suffix().is_none() {
        return Err("In-place updates are not supported on this platform".to_string());
    }

    info!("Starting update installer {:?}", path);
    std::process::Command::new(&path)
        .args(["/P", "/UPDATE", "/R"])
        .spawn()
        .map_err(|e| format!("Failed to start the installer: {e}"))?;

    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, draft: bool) -> GithubRelease {
        GithubRelease {
            tag_name: tag.to_string(),
            name: None,
            body: None,
            html_url: String::new(),
            draft,
            prerelease: true,
            published_at: None,
            assets: Vec::new(),
        }
    }

    #[test]
    fn repository_is_owner_and_name() {
        assert_eq!(github_repo().split('/').count(), 2);
    }

    #[test]
    fn newer_releases_are_sorted_and_skip_drafts_and_older() {
        let current = parse_version("0.1.1").unwrap();
        let newer = newer_releases(
            vec![
                release("v0.1.0", false),
                release("v0.1.3", false),
                release("v0.2.0", true),
                release("v0.1.2", false),
                release("v0.1.1", false),
                release("nightly", false),
            ],
            &current,
        );
        let versions: Vec<_> = newer.iter().map(|(v, _)| v.to_string()).collect();
        assert_eq!(versions, vec!["0.1.3", "0.1.2"]);
    }

    #[test]
    fn checksum_manifest_lookup() {
        let hash = "a".repeat(64);
        let manifest = format!(
            "{hash}  UXO_0.1.2_x64-setup.exe\n{}  UXO_0.1.2_x64_en-US.msi\n",
            "b".repeat(64)
        );
        assert_eq!(
            checksum_for(&manifest, "UXO_0.1.2_x64-setup.exe"),
            Some(hash.clone())
        );
        assert_eq!(
            checksum_for(&format!("{hash} *UXO.exe"), "UXO.exe"),
            Some(hash)
        );
        assert_eq!(checksum_for("short  UXO.exe", "UXO.exe"), None);
        assert_eq!(checksum_for(&manifest, "other.exe"), None);
    }

    #[test]
    fn only_github_hosts_are_trusted() {
        assert!(is_github_url(
            "https://github.com/bglglzd/uxo/releases/download/v1/a.exe"
        ));
        assert!(!is_github_url("http://github.com/a"));
        assert!(!is_github_url("https://github.com.evil.example/a"));
    }
}
