// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use uxo_app_lib::CliArgs;

fn main() {
    let cli_args = CliArgs::parse();

    // A session-only Windows `runas` replacement starts before the old UXO has
    // fully torn down. Waiting here, before `run()` installs the single-instance
    // plugin, prevents the elevated replacement from forwarding its launch back
    // to the ordinary-integrity instance and immediately exiting.
    if let Some(pid) = cli_args.wait_for_pid {
        if let Err(error) = uxo_app_lib::wait_for_previous_instance(pid) {
            eprintln!("error: could not complete administrator restart: {error}");
            return;
        }
    }

    #[cfg(target_os = "linux")]
    {
        // DMABUF renderer causes crashes on various GPU/display server configurations
        // See: https://github.com/tauri-apps/tauri/issues/9394
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    uxo_app_lib::run(cli_args)
}
