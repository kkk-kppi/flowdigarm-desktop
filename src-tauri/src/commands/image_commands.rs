use std::{fs, path::Path};

use base64::{engine::general_purpose::STANDARD, Engine};
use image::ImageFormat;
use serde::Serialize;

const MAX_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const UNSUPPORTED_IMAGE: &str = "仅支持 PNG、JPEG、WebP 图片。";

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ImageKind {
    Png,
    Jpeg,
    Webp,
}

impl ImageKind {
    fn extension_matches(self, extension: &str) -> bool {
        match self {
            Self::Png => extension.eq_ignore_ascii_case("png"),
            Self::Jpeg => {
                extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg")
            }
            Self::Webp => extension.eq_ignore_ascii_case("webp"),
        }
    }

    fn image_format(self) -> ImageFormat {
        match self {
            Self::Png => ImageFormat::Png,
            Self::Jpeg => ImageFormat::Jpeg,
            Self::Webp => ImageFormat::WebP,
        }
    }

    fn mime(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Webp => "image/webp",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRead {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

pub fn determine_image_kind(path: &Path, bytes: &[u8]) -> Result<ImageKind, String> {
    let kind = if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        ImageKind::Png
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        ImageKind::Jpeg
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        ImageKind::Webp
    } else {
        return Err(UNSUPPORTED_IMAGE.to_owned());
    };
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    kind.extension_matches(extension)
        .then_some(kind)
        .ok_or_else(|| UNSUPPORTED_IMAGE.to_owned())
}

pub fn read_image_file(path: &Path) -> Result<ImageRead, String> {
    if !path.is_absolute() || path.to_string_lossy().contains('\0') {
        return Err("文件路径无效。".to_owned());
    }
    let metadata = fs::metadata(path).map_err(|_| "无法读取图片。".to_owned())?;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("图片过大，最大支持 5 MB。".to_owned());
    }
    let bytes = fs::read(path).map_err(|_| "无法读取图片。".to_owned())?;
    read_image_bytes(path, bytes)
}

pub fn read_image_bytes(path: &Path, bytes: Vec<u8>) -> Result<ImageRead, String> {
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err("图片过大，最大支持 5 MB。".to_owned());
    }
    let kind = determine_image_kind(path, &bytes)?;
    let decoded = image::load_from_memory_with_format(&bytes, kind.image_format())
        .map_err(|_| UNSUPPORTED_IMAGE.to_owned())?;
    Ok(ImageRead {
        data_url: format!("data:{};base64,{}", kind.mime(), STANDARD.encode(bytes)),
        width: decoded.width(),
        height: decoded.height(),
    })
}

#[tauri::command]
pub fn read_image(path: String) -> Result<ImageRead, String> {
    read_image_file(Path::new(&path))
}
