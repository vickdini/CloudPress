pub mod cloudflare;
pub mod commands;
pub mod gcp;
pub mod oci;
pub mod ssh;
pub mod templates;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::generate_ssh_key,
            commands::select_private_key_file,
            commands::select_service_account_file,
            commands::open_external_url,
            commands::cancel_deployment,
            commands::fetch_zone_id,
            commands::test_ssh_connection,
            commands::save_profile,
            commands::load_profile,
            commands::deploy_full_stack,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
