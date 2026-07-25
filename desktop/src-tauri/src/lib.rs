use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

// Mirrors devUrl / frontendDist in tauri.conf.json. The app is a shell — all
// the UI lives on the server, so a debug build points at the local Next.js dev
// server and a release build at production.
#[cfg(debug_assertions)]
const BASE_URL: &str = "http://localhost:3000";
#[cfg(not(debug_assertions))]
const BASE_URL: &str = "https://jaune.space";

const PANEL_LABEL: &str = "panel";
const PANEL_W: f64 = 420.0;
const PANEL_H: f64 = 640.0;
/// Gap between the menu bar and the top of the panel.
const PANEL_GAP: f64 = 6.0;

fn panel_url() -> tauri::Url {
    format!("{BASE_URL}/home")
        .parse()
        .expect("panel URL should always parse")
}

/// The menu-bar popover. Created lazily on first use and reused after that —
/// keeping it alive means the webview stays warm, so it opens instantly.
fn ensure_panel(app: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        return Ok(win);
    }

    let win = WebviewWindowBuilder::new(app, PANEL_LABEL, WebviewUrl::External(panel_url()))
        .title("Jaune")
        .inner_size(PANEL_W, PANEL_H)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;

    // Dismiss like a real popover: clicking away closes it.
    let handle = app.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            if let Some(panel) = handle.get_webview_window(PANEL_LABEL) {
                let _ = panel.hide();
            }
        }
    });

    Ok(win)
}

/// Anchor the panel under the menu-bar icon. `anchor_x` is the click position
/// in physical pixels; without one (global hotkey) we fall back to the
/// top-right corner, where the tray icon lives anyway.
fn position_panel(win: &tauri::WebviewWindow, anchor_x: Option<f64>) -> tauri::Result<()> {
    let monitor = match win.current_monitor()? {
        Some(m) => m,
        None => return Ok(()),
    };
    let scale = monitor.scale_factor();
    let screen = monitor.size().to_logical::<f64>(scale);
    let origin = monitor.position().to_logical::<f64>(scale);

    // Menu bar height isn't exposed; the work area starts below it, so the
    // difference between the monitor top and the visible area is our offset.
    let menu_bar_h = 24.0;

    let x = match anchor_x {
        Some(px) => (px / scale) - PANEL_W / 2.0,
        None => origin.x + screen.width - PANEL_W - 12.0,
    };
    // Keep it fully on screen no matter how close to the edge the icon sits.
    let x = x.clamp(origin.x + 8.0, origin.x + screen.width - PANEL_W - 8.0);
    let y = origin.y + menu_bar_h + PANEL_GAP;

    win.set_size(LogicalSize::new(PANEL_W, PANEL_H))?;
    win.set_position(LogicalPosition::new(x, y))?;
    Ok(())
}

fn toggle_panel(app: &AppHandle, anchor_x: Option<f64>) {
    let win = match ensure_panel(app) {
        Ok(w) => w,
        Err(e) => {
            log::error!("failed to create panel window: {e}");
            return;
        }
    };

    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }

    let _ = position_panel(&win, anchor_x);
    let _ = win.show();
    let _ = win.set_focus();
}

/// Bring the full app window back, recreating it if it was closed.
fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }

    let url: tauri::Url = BASE_URL.parse().expect("base URL should always parse");
    let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Jaune")
        .inner_size(1180.0, 800.0)
        .min_inner_size(420.0, 560.0)
        .center()
        .build();
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Jaune", true, None::<&str>)?;
    let checkin = MenuItem::with_id(app, "checkin", "Today's Brief", true, Some("Cmd+Shift+J"))?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit Jaune"))?;
    let menu = Menu::with_items(app, &[&open, &checkin, &sep, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(Image::from_bytes(include_bytes!("../icons/tray@2x.png"))?)
        .icon_as_template(true)
        .tooltip("Jaune")
        .menu(&menu)
        // Left click toggles the panel; the menu is right-click only.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "checkin" => toggle_panel(app, None),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                let PhysicalPosition { x, .. } = position;
                toggle_panel(tray.app_handle(), Some(x));
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

        // Cmd+Shift+J from anywhere — the reason this is an app and not a tab.
        let hotkey = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyJ);
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(hotkey)
                .expect("hotkey should be valid")
                .with_handler(move |app, shortcut, event| {
                    if event.state == ShortcutState::Pressed && shortcut == &hotkey {
                        toggle_panel(app, None);
                    }
                })
                .build(),
        );
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            build_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
