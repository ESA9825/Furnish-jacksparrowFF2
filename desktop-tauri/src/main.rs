#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::path::PathBuf;
use tauri::{ipc::CapabilityBuilder, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[tauri::command]
fn finish_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.destroy().map_err(|e| e.to_string())
}
#[tauri::command]
fn request_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}
#[tauri::command]
fn probe_result(value: serde_json::Value) {
    if std::env::var_os("FURNISH_TAURI_PROBE_SOURCE").is_none() {
        return;
    }
    println!("FURNISH_PROBE={}", value);
}
fn main() {
    println!("FURNISH_HOST_PID={}", std::process::id());
    let url: tauri::Url = std::env::var("FURNISH_TAURI_URL")
        .expect("Use scripts/tauri-launch.cjs")
        .parse()
        .expect("Invalid URL");
    assert!(
        url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port().is_some()
            && url.path() == "/"
            && url.query().is_none()
            && url.username().is_empty()
            && url.password().is_none()
    );
    let origin = url.origin().ascii_serialization();
    let profile = PathBuf::from(std::env::var("FURNISH_TAURI_PROFILE").expect("Missing profile"));
    let profile_id: Vec<u8> = (0..16)
        .map(|i| {
            u8::from_str_radix(
                &std::env::var("FURNISH_TAURI_PROFILE_ID").expect("Missing profile ID")
                    [i * 2..i * 2 + 2],
                16,
            )
            .unwrap()
        })
        .collect();
    let probe = std::env::var("FURNISH_TAURI_PROBE_SOURCE").ok();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![finish_close, request_close, probe_result])
        .setup(move |app| {
            app.add_capability(CapabilityBuilder::new("host").window("main").remote(format!("{origin}/*")).permission("host-lifecycle"))?;
            let exports = PathBuf::from(std::env::var("FURNISH_TAURI_EXPORTS").expect("Missing export directory"));
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem as Native};
                let undo = MenuItem::with_id(app, "canvas-undo", "撤销", true, Some("CmdOrCtrl+Z"))?;
                let redo = MenuItem::with_id(app, "canvas-redo", "重做", true, Some("CmdOrCtrl+Shift+Z"))?;
                let application = Submenu::with_items(app, "Furnish Tauri", true, &[&Native::close_window(app, None)?, &Native::quit(app, None)?])?;
                let edit = Submenu::with_items(app, "编辑", true, &[&undo, &redo, &Native::separator(app)?, &Native::cut(app,None)?, &Native::copy(app,None)?, &Native::paste(app,None)?, &Native::select_all(app,None)?])?;
                app.set_menu(Menu::with_items(app, &[&application, &edit])?)?;
                app.on_menu_event(|app,event| {
                    let action = match event.id().as_ref() { "canvas-undo" => "undo", "canvas-redo" => "redo", _ => return };
                    if let Some(window) = app.get_webview_window("main") {
                        let script = format!(r#"(()=>{{const a='{action}',t=document.activeElement||document.body;if(t.matches('input,textarea,select')||t.isContentEditable)document.execCommand(a);else t.dispatchEvent(new KeyboardEvent('keydown',{{key:'z',metaKey:true,shiftKey:a==='redo',bubbles:true,cancelable:true}}));}})()"#);
                        let _ = window.eval(script);
                    }
                });
            }
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Furnish · Tauri 对照版").inner_size(1440.0,960.0).min_inner_size(360.0,480.0)
                .disable_drag_drop_handler()
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .on_download(move |_, event| {
                    match event {
                        tauri::webview::DownloadEvent::Requested { destination, .. } => {
                            let name = destination.file_name().unwrap_or(std::ffi::OsStr::new("export"));
                            let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
                            *destination = exports.join(format!("{}-{}", stamp, name.to_string_lossy()));
                        }
                        tauri::webview::DownloadEvent::Finished { success, .. } => println!("FURNISH_DOWNLOAD={success}"),
                        _ => {}
                    }
                    true
                })
                .on_navigation(move |target| target.origin().ascii_serialization() == origin)
                .on_page_load(move |window, event| {
                    if event.event() == tauri::webview::PageLoadEvent::Finished {
                        if let Some(ref script) = probe { let _ = window.eval(script); }
                    }
                });
            #[cfg(target_os = "macos")]
            { builder = builder.data_store_identifier(profile_id.try_into().unwrap()); }
            #[cfg(not(target_os = "macos"))]
            { let _ = profile_id; builder = builder.data_directory(profile); }
            #[cfg(target_os = "macos")]
            let _ = profile;
            let window = builder.build()?;
            let handle = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = handle.eval(r#"(async()=>{
                        if (window.__furnishClosing) return;
                        window.__furnishClosing = true;
                        try {
                            if (!window.FurnishRepository) throw Error('页面尚未就绪，请等待加载后关闭');
                            await window.FurnishRepository.flush();
                            if (typeof repositoryClient==='undefined'||repositoryClient.blocked||repositoryClient.pending) throw Error('文件尚未保存或存在冲突');
                            await window.__TAURI_INTERNALS__.invoke('finish_close');
                        } catch(error) { alert('未关闭：'+error.message+'。请保存或导出后重试。'); }
                        finally { window.__furnishClosing = false; }
                    })()"#);
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!()).expect("Furnish Tauri failed")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    api.prevent_exit();
                    let _ = window.close();
                }
            }
        });
}
