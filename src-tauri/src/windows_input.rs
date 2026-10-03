//! Windows input-integrity compatibility helpers.
//!
//! Windows' User Interface Privilege Isolation (UIPI) prevents a normal
//! process from observing low-level input in, or injecting `SendInput` into, a
//! process at a higher integrity level. UXO deliberately remains a normal
//! per-user application. When a user explicitly opts in, `runas` starts a new
//! administrator instance. That is session-only by default; with the opt-in
//! `run_as_administrator` setting UXO requests the same restart (and its UAC
//! prompt) on every launch. No manifest or autostart entry is changed.

use serde::Serialize;
use specta::Type;
use tauri::AppHandle;

pub(crate) const ELEVATED_TARGET_ERROR_CODE: &str = "elevated_target";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum WindowsIntegrityLevel {
    #[cfg_attr(target_os = "windows", allow(dead_code))]
    Unsupported,
    Unknown,
    Untrusted,
    Low,
    Medium,
    MediumPlus,
    High,
    System,
    Protected,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WindowsInputCompatibilityStatus {
    pub supported: bool,
    pub current_integrity: WindowsIntegrityLevel,
    pub foreground_integrity: Option<WindowsIntegrityLevel>,
    pub foreground_process_id: Option<u32>,
    pub foreground_requires_elevation: bool,
    pub running_as_administrator: bool,
    pub can_restart_as_administrator: bool,
}

#[derive(Debug, Clone, Copy)]
struct Integrity {
    rid: u32,
    level: WindowsIntegrityLevel,
}

const SECURITY_MANDATORY_LOW_RID: u32 = 0x1000;
const SECURITY_MANDATORY_MEDIUM_RID: u32 = 0x2000;
const SECURITY_MANDATORY_MEDIUM_PLUS_RID: u32 = 0x2100;
const SECURITY_MANDATORY_HIGH_RID: u32 = 0x3000;
const SECURITY_MANDATORY_SYSTEM_RID: u32 = 0x4000;
const SECURITY_MANDATORY_PROTECTED_PROCESS_RID: u32 = 0x5000;

fn classify_integrity(rid: u32) -> WindowsIntegrityLevel {
    match rid {
        0 => WindowsIntegrityLevel::Untrusted,
        SECURITY_MANDATORY_LOW_RID..SECURITY_MANDATORY_MEDIUM_RID => WindowsIntegrityLevel::Low,
        SECURITY_MANDATORY_MEDIUM_RID..SECURITY_MANDATORY_MEDIUM_PLUS_RID => {
            WindowsIntegrityLevel::Medium
        }
        SECURITY_MANDATORY_MEDIUM_PLUS_RID..SECURITY_MANDATORY_HIGH_RID => {
            WindowsIntegrityLevel::MediumPlus
        }
        SECURITY_MANDATORY_HIGH_RID..SECURITY_MANDATORY_SYSTEM_RID => WindowsIntegrityLevel::High,
        SECURITY_MANDATORY_SYSTEM_RID..SECURITY_MANDATORY_PROTECTED_PROCESS_RID => {
            WindowsIntegrityLevel::System
        }
        SECURITY_MANDATORY_PROTECTED_PROCESS_RID.. => WindowsIntegrityLevel::Protected,
        _ => WindowsIntegrityLevel::Unknown,
    }
}

fn should_offer_administrator_restart(
    current_integrity_rid: u32,
    portable: bool,
    has_same_user_elevated_token: bool,
) -> bool {
    current_integrity_rid < SECURITY_MANDATORY_HIGH_RID && !portable && has_same_user_elevated_token
}

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{
        CloseHandle, HANDLE, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
    };
    use windows::Win32::Security::{
        GetSidSubAuthority, GetSidSubAuthorityCount, GetTokenInformation, TokenElevationType,
        TokenElevationTypeLimited, TokenIntegrityLevel, TOKEN_ELEVATION_TYPE,
        TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, OpenProcessToken, WaitForSingleObject,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, SW_SHOWNORMAL,
    };

    const RESTART_WAIT_TIMEOUT_MS: u32 = 30_000;

    struct OwnedHandle(HANDLE);

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            if !self.0.is_invalid() {
                // SAFETY: OwnedHandle is constructed only from a successful
                // Win32 call that transfers one handle to this wrapper.
                let _ = unsafe { CloseHandle(self.0) };
            }
        }
    }

    fn wide(value: impl AsRef<OsStr>) -> Vec<u16> {
        value
            .as_ref()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn integrity_for_process_handle(process: HANDLE) -> Result<Integrity, String> {
        let mut token = HANDLE::default();
        // SAFETY: process is a valid process handle (or the documented current
        // process pseudo-handle), and token points to writable storage.
        unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut token) }
            .map_err(|error| format!("OpenProcessToken failed: {error}"))?;
        let token = OwnedHandle(token);

        let mut required = 0_u32;
        // The first call intentionally supplies no buffer and obtains its size.
        let _ =
            unsafe { GetTokenInformation(token.0, TokenIntegrityLevel, None, 0, &mut required) };
        if required == 0 {
            return Err("GetTokenInformation returned no integrity-label size".into());
        }

        let mut buffer = vec![0_u8; required as usize];
        // SAFETY: buffer is writable for `required` bytes and remains alive
        // while the returned SID pointer is inspected below.
        unsafe {
            GetTokenInformation(
                token.0,
                TokenIntegrityLevel,
                Some(buffer.as_mut_ptr().cast()),
                required,
                &mut required,
            )
        }
        .map_err(|error| format!("GetTokenInformation failed: {error}"))?;

        // Vec<u8> is not guaranteed to have TOKEN_MANDATORY_LABEL alignment;
        // read the small pointer-containing header without assuming alignment.
        let label = unsafe { (buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL).read_unaligned() };
        if label.Label.Sid.0.is_null() {
            return Err("process integrity label has no SID".into());
        }

        // SAFETY: the SID is owned by `buffer` and valid for the duration of
        // these two reads. Integrity SIDs always contain at least one authority.
        let count_ptr = unsafe { GetSidSubAuthorityCount(label.Label.Sid) };
        if count_ptr.is_null() || unsafe { *count_ptr } == 0 {
            return Err("process integrity SID has no sub-authority".into());
        }
        let rid_ptr = unsafe { GetSidSubAuthority(label.Label.Sid, u32::from(*count_ptr) - 1) };
        if rid_ptr.is_null() {
            return Err("process integrity SID has no RID".into());
        }
        let rid = unsafe { *rid_ptr };

        Ok(Integrity {
            rid,
            level: classify_integrity(rid),
        })
    }

    fn current_integrity() -> Result<Integrity, String> {
        // SAFETY: GetCurrentProcess returns a pseudo-handle valid in this process.
        integrity_for_process_handle(unsafe { GetCurrentProcess() })
    }

    fn current_has_same_user_elevated_token() -> Result<bool, String> {
        let mut token = HANDLE::default();
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle and token
        // points to writable storage owned by this function.
        unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) }
            .map_err(|error| format!("OpenProcessToken failed: {error}"))?;
        let token = OwnedHandle(token);

        let mut elevation_type = TOKEN_ELEVATION_TYPE(0);
        let mut returned = 0_u32;
        // TokenElevationTypeLimited means this medium-integrity process is the
        // filtered half of a UAC split token. Its elevated counterpart belongs
        // to the same Windows account, so `runas` needs consent rather than a
        // different administrator's credentials/profile.
        unsafe {
            GetTokenInformation(
                token.0,
                TokenElevationType,
                Some((&mut elevation_type as *mut TOKEN_ELEVATION_TYPE).cast()),
                std::mem::size_of::<TOKEN_ELEVATION_TYPE>() as u32,
                &mut returned,
            )
        }
        .map_err(|error| format!("GetTokenInformation(TokenElevationType) failed: {error}"))?;

        Ok(elevation_type == TokenElevationTypeLimited)
    }

    fn process_integrity(pid: u32) -> Result<Integrity, String> {
        // SAFETY: no pointer arguments; Windows validates the PID and requested access.
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }
            .map_err(|error| format!("OpenProcess({pid}) failed: {error}"))?;
        let process = OwnedHandle(process);
        integrity_for_process_handle(process.0)
    }

    fn foreground_process() -> Result<Option<(u32, Integrity)>, String> {
        // SAFETY: GetForegroundWindow has no pointer inputs.
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.0.is_null() {
            return Ok(None);
        }

        let mut pid = 0_u32;
        // SAFETY: hwnd came from Windows and pid points to writable storage.
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
        if pid == 0 {
            return Ok(None);
        }
        Ok(Some((pid, process_integrity(pid)?)))
    }

    pub(super) fn compatibility_status() -> Result<WindowsInputCompatibilityStatus, String> {
        let current = current_integrity()?;
        let foreground = foreground_process()?;
        let foreground_requires_elevation = foreground
            .as_ref()
            .map(|(_, integrity)| integrity.rid > current.rid)
            .unwrap_or(false);
        let has_same_user_elevated_token = match current_has_same_user_elevated_token() {
            Ok(value) => value,
            Err(error) => {
                log::warn!(
                    "Could not determine whether this Windows account has a linked elevated token: {error}"
                );
                false
            }
        };

        Ok(WindowsInputCompatibilityStatus {
            supported: true,
            current_integrity: current.level,
            foreground_integrity: foreground.as_ref().map(|(_, integrity)| integrity.level),
            foreground_process_id: foreground.as_ref().map(|(pid, _)| *pid),
            foreground_requires_elevation,
            running_as_administrator: current.rid >= SECURITY_MANDATORY_HIGH_RID,
            can_restart_as_administrator: should_offer_administrator_restart(
                current.rid,
                crate::portable::is_portable(),
                has_same_user_elevated_token,
            ),
        })
    }

    pub(super) fn current_process_is_elevated() -> Result<bool, String> {
        Ok(current_integrity()?.rid >= SECURITY_MANDATORY_HIGH_RID)
    }

    pub(super) fn foreground_requires_elevation() -> Result<bool, String> {
        let current = current_integrity()?;
        Ok(foreground_process()?
            .map(|(_, foreground)| foreground.rid > current.rid)
            .unwrap_or(false))
    }

    pub(super) fn restart_as_administrator(
        app: &AppHandle,
        start_hidden: bool,
    ) -> Result<(), String> {
        if crate::portable::is_portable() {
            return Err("Administrator restart is disabled for portable installations".to_string());
        }

        if current_integrity()?.rid >= SECURITY_MANDATORY_HIGH_RID {
            return Ok(());
        }

        if !current_has_same_user_elevated_token()? {
            return Err(
                "Administrator restart is unavailable because this Windows account has no same-user elevated token"
                    .to_string(),
            );
        }

        let executable = std::env::current_exe()
            .map_err(|error| format!("Failed to locate the UXO executable: {error}"))?;
        let directory = executable.parent().unwrap_or_else(|| Path::new("."));
        let mut parameters = format!("--wait-for-pid {}", std::process::id());
        if start_hidden {
            parameters.push_str(" --start-hidden");
        }
        let verb = wide("runas");
        let executable = wide(executable.as_os_str());
        let parameters = wide(parameters);
        let directory = wide(directory.as_os_str());

        // SAFETY: every PCWSTR points at a live, null-terminated UTF-16 buffer
        // for the duration of ShellExecuteW. `runas` shows the standard UAC UI.
        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(executable.as_ptr()),
                PCWSTR(parameters.as_ptr()),
                PCWSTR(directory.as_ptr()),
                SW_SHOWNORMAL,
            )
        };
        let result_code = result.0 as isize;
        if result_code <= 32 {
            return Err(format!(
                "Windows declined the administrator restart (ShellExecute code {result_code})"
            ));
        }

        log::info!(
            "Administrator replacement launched for this session; exiting PID {}",
            std::process::id()
        );
        app.exit(0);
        Ok(())
    }

    pub(super) fn wait_for_previous_instance(pid: u32) -> Result<(), String> {
        if pid == std::process::id() {
            return Err("--wait-for-pid cannot target the current process".into());
        }

        // A missing process means the predecessor completed before the
        // replacement reached this point, which is already the desired state.
        let Ok(process) = (unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, pid) }) else {
            return Ok(());
        };
        let process = OwnedHandle(process);

        // SAFETY: process is a waitable process handle owned by this scope.
        match unsafe { WaitForSingleObject(process.0, RESTART_WAIT_TIMEOUT_MS) } {
            WAIT_OBJECT_0 => Ok(()),
            WAIT_TIMEOUT => Err(format!(
                "UXO process {pid} did not exit within {} seconds",
                RESTART_WAIT_TIMEOUT_MS / 1000
            )),
            WAIT_FAILED => Err(format!("Waiting for UXO process {pid} failed")),
            other => Err(format!(
                "Waiting for UXO process {pid} returned unexpected status {}",
                other.0
            )),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_windows_input_compatibility_status() -> Result<WindowsInputCompatibilityStatus, String> {
    #[cfg(target_os = "windows")]
    {
        platform::compatibility_status()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(WindowsInputCompatibilityStatus {
            supported: false,
            current_integrity: WindowsIntegrityLevel::Unsupported,
            foreground_integrity: None,
            foreground_process_id: None,
            foreground_requires_elevation: false,
            running_as_administrator: false,
            can_restart_as_administrator: false,
        })
    }
}

#[tauri::command]
#[specta::specta]
pub fn restart_as_administrator(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        platform::restart_as_administrator(&app, true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Administrator restart is only available on Windows".into())
    }
}

/// Startup half of the `run_as_administrator` setting: when this instance is
/// not elevated, launch an elevated replacement through UAC. Returns `true`
/// when the replacement was launched and this instance is exiting. A declined
/// UAC prompt (or any other failure) keeps the current instance running.
pub(crate) fn relaunch_elevated_if_requested(app: &AppHandle, start_hidden: bool) -> bool {
    #[cfg(target_os = "windows")]
    {
        match platform::current_process_is_elevated() {
            Ok(true) => return false,
            Ok(false) => {}
            Err(error) => {
                log::warn!("Could not read UXO's integrity level; staying unelevated: {error}");
                return false;
            }
        }
        match platform::restart_as_administrator(app, start_hidden) {
            Ok(()) => true,
            Err(error) => {
                log::warn!(
                    "Administrator launch was not completed; continuing unelevated: {error}"
                );
                false
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, start_hidden);
        false
    }
}

pub(crate) fn foreground_requires_elevation() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        platform::foreground_requires_elevation()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

pub(crate) fn current_process_is_elevated() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        platform::current_process_is_elevated()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

pub fn wait_for_previous_instance(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        platform::wait_for_previous_instance(pid)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = pid;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_windows_integrity_rids() {
        assert_eq!(classify_integrity(0), WindowsIntegrityLevel::Untrusted);
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_LOW_RID),
            WindowsIntegrityLevel::Low
        );
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_MEDIUM_RID),
            WindowsIntegrityLevel::Medium
        );
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_MEDIUM_PLUS_RID),
            WindowsIntegrityLevel::MediumPlus
        );
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_HIGH_RID),
            WindowsIntegrityLevel::High
        );
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_SYSTEM_RID),
            WindowsIntegrityLevel::System
        );
        assert_eq!(
            classify_integrity(SECURITY_MANDATORY_PROTECTED_PROCESS_RID),
            WindowsIntegrityLevel::Protected
        );
    }

    #[test]
    fn administrator_restart_requires_same_user_split_token() {
        assert!(should_offer_administrator_restart(
            SECURITY_MANDATORY_MEDIUM_RID,
            false,
            true
        ));
        assert!(!should_offer_administrator_restart(
            SECURITY_MANDATORY_MEDIUM_RID,
            false,
            false
        ));
        assert!(!should_offer_administrator_restart(
            SECURITY_MANDATORY_MEDIUM_RID,
            true,
            true
        ));
        assert!(!should_offer_administrator_restart(
            SECURITY_MANDATORY_HIGH_RID,
            false,
            true
        ));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn reads_current_windows_process_integrity() {
        let status = platform::compatibility_status().expect("status probe should succeed");
        assert!(status.supported);
        assert_ne!(status.current_integrity, WindowsIntegrityLevel::Unknown);
    }
}
