mod png_metadata;

use std::fs;
use std::path::{Path, PathBuf};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_bubble_png_with_metadata,
            read_bubble_png_metadata_from_bytes,
            delete_bubble_png_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
