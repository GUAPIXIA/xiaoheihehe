#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use heybox_backend::{
    error::{AppError, Result},
    storage::data_directory,
    Backend, Command,
};
use serde_json::{json, Value};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    LogicalSize, Manager, WindowEvent,
};

fn scaled_window_size(
    zoom: u32,
    show_sidebar: bool,
    window_height: u32,
    window_width: Option<u32>,
    max_w: f64,
    max_h: f64,
) -> LogicalSize<f64> {
    let scale = zoom as f64 / 100.;
    let width = window_width.unwrap_or(if show_sidebar { 960 } else { 720 }) as f64 * scale;
    let height = window_height as f64 * scale;
    let fit = (max_w / width).min(max_h / height).min(1.);
    LogicalSize::new(width * fit, height * fit)
}

#[tauri::command]
async fn command(state: tauri::State<'_, Backend>, request: Command) -> Result<Value> {
    state.execute(request).await
}

#[tauri::command]
fn window_action(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Backend>,
    action: String,
    zoom: Option<u32>,
    show_sidebar: Option<bool>,
    window_height: Option<u32>,
    window_width: Option<u32>,
) -> Result<()> {
    let fail = |_| AppError::new("window", "窗口操作失败");
    match action.as_str() {
        "minimize" => window.minimize().map_err(fail),
        "maximize" => {
            if window.is_maximized().map_err(fail)? {
                window.unmaximize().map_err(fail)
            } else {
                window.maximize().map_err(fail)
            }
        }
        "drag" => window.start_dragging().map_err(fail),
        "close" => {
            let prefs = state
                .storage
                .get("heybox.preferences")?
                .unwrap_or(json!({}));
            if prefs["exit"] == "tray" {
                window.hide().map_err(fail)
            } else {
                window.app_handle().exit(0);
                Ok(())
            }
        }
        "scale" => {
            let zoom = zoom.ok_or_else(AppError::invalid)?;
            let height = window_height.unwrap_or(760);
            if !(50..=300).contains(&zoom)
                || !(480..=1200).contains(&height)
                || window_width.is_some_and(|width| !(600..=1600).contains(&width))
            {
                return Err(AppError::invalid());
            }
            if window.is_maximized().map_err(fail)? {
                return Ok(());
            }
            let monitor = window.current_monitor().map_err(fail)?;
            let (max_w, max_h) = monitor
                .map(|m| {
                    (
                        m.size().width as f64 / m.scale_factor() - 40.,
                        m.size().height as f64 / m.scale_factor() - 80.,
                    )
                })
                .unwrap_or((1920., 1080.));
            window
                .set_size(scaled_window_size(
                    zoom,
                    show_sidebar.unwrap_or(false),
                    height,
                    window_width,
                    max_w,
                    max_h,
                ))
                .map_err(fail)?;
            window.center().map_err(fail)
        }
        _ => Err(AppError::invalid()),
    }
}

#[tauri::command]
fn open_official(url: String) -> Result<()> {
    if !url.starts_with("https://xiaoheihe.cn/") && !url.starts_with("https://www.xiaoheihe.cn/") {
        return Err(AppError::invalid());
    }
    std::process::Command::new("explorer.exe")
        .arg(url)
        .spawn()
        .map_err(|_| AppError::new("browser", "无法打开浏览器"))?;
    Ok(())
}

fn main() {
    let backend = Backend::new(data_directory()).unwrap_or_else(|e| {
        eprintln!("{}", e.message);
        std::process::exit(1)
    });
    tauri::Builder::default()
        .manage(backend)
        .invoke_handler(tauri::generate_handler![
            command,
            window_action,
            open_official
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<Backend>();
                if state
                    .storage
                    .get("heybox.preferences")
                    .ok()
                    .flatten()
                    .map(|v| v["exit"] == "tray")
                    .unwrap_or(false)
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "打开社区", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("小黑盒盒")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("无法启动桌面应用");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_width_is_independent_of_sidebar_and_fits_screen() {
        for width in [600, 720, 960, 1600] {
            for height in [480, 760, 1200] {
                for show in [false, true] {
                    let size = scaled_window_size(100, show, height, Some(width), 2400., 1600.);
                    assert_eq!(size.width, width as f64);
                    assert_eq!(size.height, height as f64);
                    for zoom in [50, 125, 300] {
                        let fitted =
                            scaled_window_size(zoom, show, height, Some(width), 1600., 900.);
                        assert!(fitted.width <= 1600. && fitted.height <= 900.);
                        assert!(
                            (fitted.width / fitted.height - width as f64 / height as f64).abs()
                                < 1e-9
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn window_height_changes_shape_and_fits_screen() {
        for height in [480, 760, 1200] {
            for show in [false, true] {
                let width = if show { 960. } else { 720. };
                let size = scaled_window_size(100, show, height, None, 2400., 1600.);
                assert_eq!(size.width, width);
                assert_eq!(size.height, height as f64);
                for zoom in [50, 100, 300] {
                    let fitted = scaled_window_size(zoom, show, height, None, 1600., 900.);
                    assert!(fitted.width <= 1600. && fitted.height <= 900.);
                    assert!((fitted.width / fitted.height - width / height as f64).abs() < 1e-9);
                }
            }
        }
    }

    #[test]
    fn window_shape_survives_zoom_and_monitor_limits() {
        let hidden = scaled_window_size(100, false, 760, None, 1920., 1080.);
        let shown = scaled_window_size(100, true, 760, None, 1920., 1080.);
        assert!(hidden.width < shown.width);
        assert_eq!(hidden.height, shown.height);
        for show in [false, true] {
            let normal = scaled_window_size(100, show, 760, None, 1920., 1080.);
            for zoom in [50, 125, 300] {
                let size = scaled_window_size(zoom, show, 760, None, 1600., 900.);
                assert!(size.width <= 1600. && size.height <= 900.);
                assert!(size.width >= 360. && size.height >= 380.);
                assert!((size.width / size.height - normal.width / normal.height).abs() < 1e-9);
            }
        }
    }
}
