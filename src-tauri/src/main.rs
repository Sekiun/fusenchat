mod png_metadata;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use png_metadata::{read_png_metadata, write_png_with_metadata, FusenchatPngMetadata};
use serde::Deserialize;
use tauri::Manager;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveBubblePngRequest {
    bytes: Vec<u8>,
    file_name: String,
    metadata: FusenchatPngMetadata,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadBubbleMetadataRequest {
    bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteBubblePngRequest {
    file_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartBubbleFileDragRequest {
    file_path: String,
}

#[tauri::command]
fn save_bubble_png_with_metadata(
    app: tauri::AppHandle,
    payload: SaveBubblePngRequest,
) -> Result<String, String> {
    ensure_png_file_name(&payload.file_name)?;

    let bubble_dir = bubble_cache_dir(&app)?;
    let file_path = bubble_dir.join(payload.file_name);
    let encoded = write_png_with_metadata(&payload.bytes, &payload.metadata)?;

    fs::write(&file_path, encoded).map_err(|error| format!("Failed to save PNG file: {error}"))?;

    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_bubble_png_metadata_from_bytes(
    payload: ReadBubbleMetadataRequest,
) -> Result<Option<FusenchatPngMetadata>, String> {
    read_png_metadata(&payload.bytes)
}

#[tauri::command]
fn delete_bubble_png_file(
    app: tauri::AppHandle,
    payload: DeleteBubblePngRequest,
) -> Result<(), String> {
    let file_path = ensure_bubble_file_path(&app, &payload.file_path)?;
    fs::remove_file(&file_path).map_err(|error| format!("Failed to delete PNG file: {error}"))?;
    Ok(())
}

#[tauri::command]
fn start_bubble_file_drag(
    app: tauri::AppHandle,
    window: tauri::Window,
    payload: StartBubbleFileDragRequest,
) -> Result<(), String> {
    let file_path = ensure_bubble_file_path(&app, &payload.file_path)?;
    let preview_icon_path = file_path.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    app.run_on_main_thread(move || {
        #[cfg(target_os = "linux")]
        let raw_window = window.gtk_window().map_err(|error| error.to_string());
        #[cfg(not(target_os = "linux"))]
        let raw_window: Result<tauri::Window, String> = Ok(window.clone());

        let drag_result = match raw_window {
            Ok(raw_window) => drag::start_drag(
                &raw_window,
                drag::DragItem::Files(vec![file_path]),
                drag::Image::File(preview_icon_path),
                |_, _| {},
                drag::Options::default(),
            )
            .map_err(|error| format!("Failed to start native file drag: {error}")),
            Err(error) => Err(format!(
                "Failed to access the native window for drag out: {error}"
            )),
        };

        let _ = tx.send(drag_result);
    })
    .map_err(|error| format!("Failed to schedule native drag start: {error}"))?;

    rx.recv()
        .map_err(|error| format!("Failed to receive native drag result: {error}"))?
}

#[tauri::command]
fn list_system_font_families() -> Result<Vec<String>, String> {
    list_system_font_families_impl()
}

fn bubble_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let local_data_dir = app
        .path()
        .local_data_dir()
        .map_err(|error| format!("Failed to resolve local data directory: {error}"))?;
    let bubble_dir = local_data_dir.join("fusenchat").join("cache").join("bubbles");
    fs::create_dir_all(&bubble_dir)
        .map_err(|error| format!("Failed to create bubble cache directory: {error}"))?;
    Ok(bubble_dir)
}

fn ensure_png_file_name(file_name: &str) -> Result<(), String> {
    if file_name.is_empty() {
        return Err("PNG file name is empty.".to_string());
    }

    if file_name.contains(['/', '\\', ':']) {
        return Err("PNG file name contains an invalid path separator.".to_string());
    }

    if !file_name.to_ascii_lowercase().ends_with(".png") {
        return Err("PNG file name must end with .png.".to_string());
    }

    Ok(())
}

fn ensure_bubble_file_path(app: &tauri::AppHandle, file_path: &str) -> Result<PathBuf, String> {
    let bubble_dir = bubble_cache_dir(app)?;
    let bubble_dir = bubble_dir
        .canonicalize()
        .map_err(|error| format!("Failed to canonicalize bubble directory: {error}"))?;
    let candidate = Path::new(file_path);
    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("Failed to resolve PNG file path: {error}"))?;

    if !canonical.starts_with(&bubble_dir) {
        return Err("Refusing to touch files outside the bubble cache directory.".to_string());
    }

    Ok(canonical)
}

fn dedupe_and_sort_font_families(fonts: Vec<String>) -> Vec<String> {
    let mut fonts = fonts
        .into_iter()
        .filter_map(|family| normalize_font_family_name(&family))
        .collect::<Vec<_>>();
    fonts.sort_unstable_by(|left, right| left.to_lowercase().cmp(&right.to_lowercase()));
    fonts.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    fonts
}

fn normalize_font_family_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_suffix = if let Some(index) = trimmed.rfind(" (") {
        if trimmed.ends_with(')') {
            &trimmed[..index]
        } else {
            trimmed
        }
    } else {
        trimmed
    };

    let normalized = without_suffix.trim();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized.to_string())
    }
}

#[cfg(target_os = "windows")]
fn list_system_font_families_impl() -> Result<Vec<String>, String> {
    let installed_fonts = query_windows_installed_font_collection()?;
    if !installed_fonts.is_empty() {
        return Ok(dedupe_and_sort_font_families(installed_fonts));
    }

    let mut fonts = Vec::new();
    fonts.extend(query_windows_font_registry(
        r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
    )?);
    fonts.extend(query_windows_font_registry(
        r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
    )?);
    Ok(dedupe_and_sort_font_families(fonts))
}

#[cfg(target_os = "windows")]
fn query_windows_installed_font_collection() -> Result<Vec<String>, String> {
    let script = "[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null; [System.Drawing.Text.InstalledFontCollection]::new().Families | Select-Object -ExpandProperty Name";
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|error| format!("Failed to inspect installed Windows fonts: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to inspect installed Windows fonts: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

#[cfg(target_os = "windows")]
fn query_windows_font_registry(key_path: &str) -> Result<Vec<String>, String> {
    let output = Command::new("reg")
        .args(["query", key_path])
        .output()
        .map_err(|error| format!("Failed to query Windows font registry: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to query Windows font registry '{}': {}",
            key_path,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut fonts = Vec::new();

    for line in stdout.lines() {
        if let Some((name, _)) = line.split_once("REG_") {
            let candidate = name.trim();
            if !candidate.is_empty() {
                fonts.push(candidate.to_string());
            }
        }
    }

    Ok(fonts)
}

#[cfg(target_os = "macos")]
fn list_system_font_families_impl() -> Result<Vec<String>, String> {
    let output = Command::new("system_profiler")
        .arg("SPFontsDataType")
        .output()
        .map_err(|error| format!("Failed to inspect macOS fonts: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to inspect macOS fonts: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let fonts = stdout
        .lines()
        .filter_map(|line| line.trim().strip_prefix("Family:"))
        .map(|family| family.trim().to_string())
        .collect::<Vec<_>>();

    Ok(dedupe_and_sort_font_families(fonts))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn list_system_font_families_impl() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_bubble_png_with_metadata,
            read_bubble_png_metadata_from_bytes,
            delete_bubble_png_file,
            start_bubble_file_drag,
            list_system_font_families
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
