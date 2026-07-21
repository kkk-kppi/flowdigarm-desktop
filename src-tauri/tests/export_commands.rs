use std::fs;

use flowchart_editor_lib::commands::export_commands::{
    export_request, ExportLinkAnnotation, ExportPagePayload, NativeExportRequest,
};
use image::GenericImageView;
use tempfile::tempdir;

fn page(name: &str, width: f64, height: f64) -> ExportPagePayload {
    ExportPagePayload {
        name: name.to_owned(),
        width_pt: width,
        height_pt: height,
        svg: format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="{width}pt" height="{height}pt" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#fff"/><rect x="2" y="3" width="10" height="11" fill="#123456"/></svg>"##
        ),
        links: vec![],
    }
}

fn request(
    path: &std::path::Path,
    format: &str,
    pages: Vec<ExportPagePayload>,
) -> NativeExportRequest {
    NativeExportRequest {
        format: format.to_owned(),
        scope: if pages.len() > 1 {
            "allPages"
        } else {
            "currentPage"
        }
        .to_owned(),
        file_name: "流程".to_owned(),
        path: path.to_string_lossy().into_owned(),
        dpi: None,
        pages,
        document_json: None,
    }
}

#[test]
fn png_dimensions_are_exact_at_every_supported_dpi() {
    for dpi in [96, 150, 300] {
        let dir = tempdir().unwrap();
        let path = dir.path().join(format!("dpi-{dpi}.png"));
        let mut input = request(&path, "png", vec![page("P", 72.0, 36.0)]);
        input.dpi = Some(dpi);

        assert_eq!(export_request(input).unwrap(), vec![path.to_string_lossy()]);
        assert_eq!(image::open(path).unwrap().dimensions(), (dpi, dpi / 2));
    }
}

#[test]
fn pdf_has_ordered_pages_exact_media_boxes_and_safe_uri_annotations() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("multi.pdf");
    let mut first = page("一", 72.0, 36.0);
    first.links.push(ExportLinkAnnotation {
        url: "https://example.com/a(b)".to_owned(),
        x_pt: 1.0,
        y_pt: 2.0,
        width_pt: 10.0,
        height_pt: 12.0,
    });
    let input = request(&path, "pdf", vec![first, page("二", 144.0, 72.0)]);

    export_request(input).unwrap();
    let bytes = fs::read(path).unwrap();
    let pdf = String::from_utf8_lossy(&bytes);
    assert!(pdf.starts_with("%PDF-1.7"));
    assert_eq!(pdf.matches("/Type /Page ").count(), 2);
    assert!(pdf.contains("/MediaBox [0 0 72 36]"));
    assert!(pdf.contains("/MediaBox [0 0 144 72]"));
    assert!(pdf.contains("/Subtype /Link"));
    assert!(pdf.contains("/S /URI /URI (https://example.com/a\\(b\\))"));
}

#[test]
fn svg_and_json_write_atomically_and_return_actual_paths() {
    let dir = tempdir().unwrap();
    let svg_path = dir.path().join("diagram.svg");
    let svg = page("P", 72.0, 36.0).svg;
    let result = export_request(request(&svg_path, "svg", vec![page("P", 72.0, 36.0)])).unwrap();
    assert_eq!(result, vec![svg_path.to_string_lossy()]);
    assert_eq!(fs::read_to_string(svg_path).unwrap(), svg);

    let json_path = dir.path().join("diagram.flowdiagram");
    let mut json = request(&json_path, "json", vec![]);
    json.scope = "allPages".to_owned();
    json.document_json = Some(r#"{"schemaVersion":1}"#.to_owned());
    export_request(json).unwrap();
    assert_eq!(
        fs::read_to_string(json_path).unwrap(),
        r#"{"schemaVersion":1}"#
    );
}

#[test]
fn all_page_generation_failure_preserves_every_existing_target() {
    let dir = tempdir().unwrap();
    let selected = dir.path().join("flow.svg");
    let first_target = dir.path().join("flow-01-good.svg");
    let second_target = dir.path().join("flow-02-bad.svg");
    fs::write(&first_target, b"old-first").unwrap();
    fs::write(&second_target, b"old-second").unwrap();
    let good = page("good", 72.0, 36.0);
    let mut bad = page("bad", 72.0, 36.0);
    bad.svg = "<svg>".to_owned();

    assert!(export_request(request(&selected, "svg", vec![good, bad])).is_err());
    assert_eq!(fs::read(first_target).unwrap(), b"old-first");
    assert_eq!(fs::read(second_target).unwrap(), b"old-second");
}

#[test]
fn rejects_invalid_paths_formats_dpi_sizes_payloads_and_links() {
    let dir = tempdir().unwrap();
    let absolute = dir.path().join("bad.png");
    let mut invalid_path = request(
        std::path::Path::new("relative.png"),
        "png",
        vec![page("P", 72.0, 36.0)],
    );
    invalid_path.dpi = Some(96);
    assert_eq!(export_request(invalid_path).unwrap_err(), "导出路径无效。");

    let mut invalid_dpi = request(&absolute, "png", vec![page("P", 72.0, 36.0)]);
    invalid_dpi.dpi = Some(72);
    assert_eq!(
        export_request(invalid_dpi).unwrap_err(),
        "PNG DPI 仅支持 96、150 或 300。"
    );

    let mut invalid_size = request(&absolute, "png", vec![page("P", f64::NAN, 36.0)]);
    invalid_size.dpi = Some(96);
    assert_eq!(
        export_request(invalid_size).unwrap_err(),
        "导出页面尺寸无效。"
    );

    let mut unsafe_page = page("P", 72.0, 36.0);
    unsafe_page.links.push(ExportLinkAnnotation {
        url: "javascript:alert(1)".to_owned(),
        x_pt: 0.0,
        y_pt: 0.0,
        width_pt: 1.0,
        height_pt: 1.0,
    });
    let unsafe_link = request(&dir.path().join("bad.pdf"), "pdf", vec![unsafe_page]);
    assert_eq!(
        export_request(unsafe_link).unwrap_err(),
        "导出链接协议不允许。"
    );

    let invalid_format = request(
        &dir.path().join("bad.bin"),
        "bin",
        vec![page("P", 72.0, 36.0)],
    );
    assert_eq!(
        export_request(invalid_format).unwrap_err(),
        "导出格式无效。"
    );
}
