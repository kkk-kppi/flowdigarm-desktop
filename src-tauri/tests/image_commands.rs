use std::fs;

use flowchart_editor_lib::commands::image_commands::{
    determine_image_kind, read_image_file, ImageKind,
};
use image::{codecs::png::PngEncoder, ColorType, ImageEncoder};
use tempfile::tempdir;

const PNG_1X1: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

fn valid_png() -> Vec<u8> {
    let mut bytes = Vec::new();
    PngEncoder::new(&mut bytes)
        .write_image(&[0xff, 0, 0, 0xff], 1, 1, ColorType::Rgba8)
        .unwrap();
    bytes
}

#[test]
fn detects_supported_magic_only_when_extension_matches() {
    assert_eq!(
        determine_image_kind(std::path::Path::new("a.png"), PNG_1X1).unwrap(),
        ImageKind::Png
    );
    assert_eq!(
        determine_image_kind(std::path::Path::new("a.jpeg"), &[0xff, 0xd8, 0xff, 0x00]).unwrap(),
        ImageKind::Jpeg
    );
    assert_eq!(
        determine_image_kind(std::path::Path::new("a.webp"), b"RIFF0000WEBP").unwrap(),
        ImageKind::Webp
    );
    assert_eq!(
        determine_image_kind(std::path::Path::new("a.jpg"), PNG_1X1).unwrap_err(),
        "仅支持 PNG、JPEG、WebP 图片。"
    );
    assert_eq!(
        determine_image_kind(std::path::Path::new("a.svg"), b"<svg/>").unwrap_err(),
        "仅支持 PNG、JPEG、WebP 图片。"
    );
}

#[test]
fn reads_a_valid_png_as_data_url_with_reliable_dimensions() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("pixel.png");
    fs::write(&path, valid_png()).unwrap();

    let image = read_image_file(&path).unwrap();

    assert_eq!((image.width, image.height), (1, 1));
    assert!(image.data_url.starts_with("data:image/png;base64,"));
}

#[test]
fn rejects_relative_and_oversized_paths_before_decode() {
    assert_eq!(
        read_image_file(std::path::Path::new("relative.png")).unwrap_err(),
        "文件路径无效。"
    );

    let directory = tempdir().unwrap();
    let path = directory.path().join("large.png");
    fs::write(&path, vec![0_u8; 5 * 1024 * 1024 + 1]).unwrap();
    assert_eq!(
        read_image_file(&path).unwrap_err(),
        "图片过大，最大支持 5 MB。"
    );
}
