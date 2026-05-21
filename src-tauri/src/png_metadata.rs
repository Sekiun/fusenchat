use std::io::Cursor;

use serde::{Deserialize, Serialize};

const TEXT_KEY: &str = "fusenchat:text";
const PAYLOAD_KEY: &str = "fusenchat:payload";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusenchatPngMetadata {
    pub text: String,
    pub created_at: String,
    pub app: Option<String>,
}

pub fn write_png_with_metadata(
    png_bytes: &[u8],
    metadata: &FusenchatPngMetadata,
) -> Result<Vec<u8>, String> {
    let decoder = png::Decoder::new(Cursor::new(png_bytes));
    let mut reader = decoder
        .read_info()
        .map_err(|error| format!("Failed to read PNG: {error}"))?;
    let buffer_size = reader
        .output_buffer_size()
        .ok_or_else(|| "Failed to determine PNG output buffer size.".to_string())?;
    let mut buffer = vec![0; buffer_size];
    let output_info = reader
        .next_frame(&mut buffer)
        .map_err(|error| format!("Failed to decode PNG frame: {error}"))?;
    let pixels = &buffer[..output_info.buffer_size()];

    let payload = serde_json::to_string(metadata)
        .map_err(|error| format!("Failed to serialize PNG metadata payload: {error}"))?;

    let mut encoded = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut encoded, output_info.width, output_info.height);
        encoder.set_color(output_info.color_type);
        encoder.set_depth(output_info.bit_depth);
        encoder
            .add_itxt_chunk(TEXT_KEY.to_owned(), metadata.text.clone())
            .map_err(|error| format!("Failed to add text metadata chunk: {error}"))?;
        encoder
            .add_itxt_chunk(PAYLOAD_KEY.to_owned(), payload)
            .map_err(|error| format!("Failed to add payload metadata chunk: {error}"))?;

        let mut writer = encoder
            .write_header()
            .map_err(|error| format!("Failed to write PNG header: {error}"))?;
        writer
            .write_image_data(pixels)
            .map_err(|error| format!("Failed to encode PNG with metadata: {error}"))?;
    }

    Ok(encoded)
}

pub fn read_png_metadata(bytes: &[u8]) -> Result<Option<FusenchatPngMetadata>, String> {
    let decoder = png::Decoder::new(Cursor::new(bytes));
    let mut reader = decoder
        .read_info()
        .map_err(|error| format!("Failed to open PNG metadata: {error}"))?;
    let buffer_size = reader
        .output_buffer_size()
        .ok_or_else(|| "Failed to determine PNG metadata buffer size.".to_string())?;
    let mut buffer = vec![0; buffer_size];
    reader
        .next_frame(&mut buffer)
        .map_err(|error| format!("Failed to read PNG frame: {error}"))?;

    let info = reader.info();

    if let Some(chunk) = info.utf8_text.iter().find(|chunk| chunk.keyword == PAYLOAD_KEY) {
        let payload = chunk
            .get_text()
            .map_err(|error| format!("Failed to decode PNG metadata payload: {error}"))?;
        let metadata = serde_json::from_str::<FusenchatPngMetadata>(&payload)
            .map_err(|error| format!("Failed to parse PNG metadata payload: {error}"))?;
        return Ok(Some(metadata));
    }

    if let Some(chunk) = info.utf8_text.iter().find(|chunk| chunk.keyword == TEXT_KEY) {
        let text = chunk
            .get_text()
            .map_err(|error| format!("Failed to decode PNG text metadata: {error}"))?;
        return Ok(Some(FusenchatPngMetadata {
            text,
            created_at: String::new(),
            app: Some("fusenchat".to_string()),
        }));
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::{read_png_metadata, write_png_with_metadata, FusenchatPngMetadata};

    #[test]
    fn round_trips_png_metadata() {
        let source_png = generate_png();
        let metadata = FusenchatPngMetadata {
            text: "docsに沿って作って".to_string(),
            created_at: "2026-05-22T15:30:12.123+09:00".to_string(),
            app: Some("fusenchat".to_string()),
        };

        let encoded = write_png_with_metadata(&source_png, &metadata).expect("metadata write");
        let decoded = read_png_metadata(&encoded).expect("metadata read");

        assert_eq!(decoded.expect("metadata").text, metadata.text);
    }

    fn generate_png() -> Vec<u8> {
        let mut bytes = Vec::new();
        let mut encoder = png::Encoder::new(&mut bytes, 1, 1);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        let mut writer = encoder.write_header().expect("header");
        writer.write_image_data(&[0_u8, 0, 0, 0]).expect("pixels");
        bytes
    }
}
