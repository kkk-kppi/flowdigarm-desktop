use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use resvg::usvg::{TreeParsing, TreeTextToPath};
use resvg::{tiny_skia, usvg};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::security::url_policy::validate_url;

const MAX_SVG_BYTES: usize = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES: usize = 100 * 1024 * 1024;
const MAX_PAGE_PT: f64 = 1_000_000.0;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportLinkAnnotation {
    pub url: String,
    pub x_pt: f64,
    pub y_pt: f64,
    pub width_pt: f64,
    pub height_pt: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPagePayload {
    pub name: String,
    pub width_pt: f64,
    pub height_pt: f64,
    pub svg: String,
    pub links: Vec<ExportLinkAnnotation>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeExportRequest {
    pub format: String,
    pub scope: String,
    pub file_name: String,
    pub path: String,
    pub dpi: Option<u32>,
    pub pages: Vec<ExportPagePayload>,
    pub document_json: Option<String>,
}

struct GeneratedFile {
    path: PathBuf,
    bytes: Vec<u8>,
}

struct StagedFile {
    target: PathBuf,
    temporary: PathBuf,
    backup: Option<PathBuf>,
    installed: bool,
}

fn finite_range(value: f64, allow_zero: bool) -> bool {
    value.is_finite() && value <= MAX_PAGE_PT && (value > 0.0 || (allow_zero && value == 0.0))
}

fn validate_request(input: &NativeExportRequest) -> Result<(), String> {
    let path = Path::new(&input.path);
    if !path.is_absolute() || input.path.contains('\0') || path.file_name().is_none() {
        return Err("导出路径无效。".into());
    }
    if !matches!(input.format.as_str(), "svg" | "png" | "pdf" | "json") {
        return Err("导出格式无效。".into());
    }
    if !matches!(input.scope.as_str(), "currentPage" | "allPages") {
        return Err("导出范围无效。".into());
    }
    let expected_extension = match input.format.as_str() {
        "svg" => "svg",
        "png" => "png",
        "pdf" => "pdf",
        _ => "flowdiagram",
    };
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(expected_extension))
    {
        return Err("导出文件扩展名无效。".into());
    }
    if input.file_name.trim().is_empty() {
        return Err("文件名不能为空。".into());
    }
    if input.format == "png" && !matches!(input.dpi, Some(96 | 150 | 300)) {
        return Err("PNG DPI 仅支持 96、150 或 300。".into());
    }
    if input.format == "json" {
        let json = input.document_json.as_deref().ok_or("导出数据无效。")?;
        if json.len() > MAX_SVG_BYTES || serde_json::from_str::<serde_json::Value>(json).is_err() {
            return Err("导出数据无效。".into());
        }
        return Ok(());
    }
    if input.pages.is_empty() || (input.scope == "currentPage" && input.pages.len() != 1) {
        return Err("导出页面无效。".into());
    }
    let total = input.pages.iter().try_fold(0usize, |total, page| {
        if !finite_range(page.width_pt, false) || !finite_range(page.height_pt, false) {
            return Err("导出页面尺寸无效。".to_owned());
        }
        if page.svg.len() > MAX_SVG_BYTES {
            return Err("导出内容过大。".to_owned());
        }
        for link in &page.links {
            if validate_url(&link.url).is_err() {
                return Err("导出链接协议不允许。".to_owned());
            }
            if !finite_range(link.x_pt, true)
                || !finite_range(link.y_pt, true)
                || !finite_range(link.width_pt, false)
                || !finite_range(link.height_pt, false)
            {
                return Err("导出链接区域无效。".to_owned());
            }
        }
        total
            .checked_add(page.svg.len())
            .ok_or_else(|| "导出内容过大。".to_owned())
    })?;
    if total > MAX_TOTAL_BYTES {
        return Err("导出内容过大。".into());
    }
    Ok(())
}

fn safe_file_part(value: &str) -> String {
    let filtered: String = value
        .chars()
        .filter(|character| {
            !matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        })
        .collect();
    let trimmed = filtered.trim().trim_end_matches(['.', ' ']);
    if trimmed.is_empty() {
        "页面".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn output_paths(input: &NativeExportRequest) -> Result<Vec<PathBuf>, String> {
    let selected = Path::new(&input.path);
    if input.scope != "allPages" || matches!(input.format.as_str(), "pdf" | "json") {
        return Ok(vec![selected.to_owned()]);
    }
    let parent = selected.parent().ok_or("导出路径无效。")?;
    let stem = selected
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or("导出路径无效。")?;
    let extension = selected
        .extension()
        .and_then(|value| value.to_str())
        .ok_or("导出路径无效。")?;
    let digits = input.pages.len().to_string().len().max(2);
    Ok(input
        .pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            parent.join(format!(
                "{stem}-{:0digits$}-{}.{}",
                index + 1,
                safe_file_part(&page.name),
                extension
            ))
        })
        .collect())
}

fn parse_svg(svg: &str) -> Result<resvg::Tree, String> {
    let mut options = usvg::Options::default();
    options.resources_dir = None;
    let mut tree = usvg::Tree::from_str(svg, &options).map_err(|_| "SVG 内容无效。".to_owned())?;
    let mut fonts = usvg::fontdb::Database::new();
    fonts.load_system_fonts();
    tree.convert_text(&fonts);
    Ok(resvg::Tree::from_usvg(&tree))
}

fn rasterize(page: &ExportPagePayload, dpi: u32) -> Result<tiny_skia::Pixmap, String> {
    let tree = parse_svg(&page.svg)?;
    let width = (page.width_pt * dpi as f64 / 72.0).round();
    let height = (page.height_pt * dpi as f64 / 72.0).round();
    if width < 1.0 || height < 1.0 || width > u32::MAX as f64 || height > u32::MAX as f64 {
        return Err("导出像素尺寸无效。".into());
    }
    let mut pixmap = tiny_skia::Pixmap::new(width as u32, height as u32)
        .ok_or_else(|| "无法分配导出图像。".to_owned())?;
    let transform = tiny_skia::Transform::from_scale(
        width as f32 / tree.size.width(),
        height as f32 / tree.size.height(),
    );
    tree.render(transform, &mut pixmap.as_mut());
    Ok(pixmap)
}

fn pdf_number(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{value:.0}")
    } else {
        let formatted = format!("{value:.3}");
        formatted
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_owned()
    }
}

fn pdf_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .replace(['\r', '\n'], " ")
}

fn rgb_bytes(pixmap: &tiny_skia::Pixmap) -> Vec<u8> {
    pixmap
        .data()
        .chunks_exact(4)
        .flat_map(|pixel| {
            let alpha_remainder = 255u16 - pixel[3] as u16;
            [
                (pixel[0] as u16 + alpha_remainder).min(255) as u8,
                (pixel[1] as u16 + alpha_remainder).min(255) as u8,
                (pixel[2] as u16 + alpha_remainder).min(255) as u8,
            ]
        })
        .collect()
}

fn stream(dictionary: &str, bytes: &[u8]) -> Vec<u8> {
    let mut output = format!("<< {dictionary} /Length {} >>\nstream\n", bytes.len()).into_bytes();
    output.extend_from_slice(bytes);
    output.extend_from_slice(b"\nendstream");
    output
}

fn build_pdf(pages: &[ExportPagePayload]) -> Result<Vec<u8>, String> {
    let mut objects: Vec<Option<Vec<u8>>> = vec![None, None];
    let mut page_records = Vec::with_capacity(pages.len());
    for page in pages {
        let pixmap = rasterize(page, 72)?;
        let page_id = objects.len() + 1;
        objects.push(None);
        let image_id = objects.len() + 1;
        objects.push(Some(stream(
            &format!(
                "/Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8",
                pixmap.width(), pixmap.height()
            ),
            &rgb_bytes(&pixmap),
        )));
        let content_id = objects.len() + 1;
        let content = format!(
            "q\n{} 0 0 -{} 0 {} cm\n/Im{} Do\nQ",
            pdf_number(page.width_pt),
            pdf_number(page.height_pt),
            pdf_number(page.height_pt),
            page_id
        );
        objects.push(Some(stream("", content.as_bytes())));
        let mut annotations = Vec::new();
        for link in &page.links {
            let annotation_id = objects.len() + 1;
            let left = link.x_pt;
            let bottom = page.height_pt - link.y_pt - link.height_pt;
            let right = link.x_pt + link.width_pt;
            let top = page.height_pt - link.y_pt;
            objects.push(Some(format!(
                "<< /Type /Annot /Subtype /Link /Rect [{} {} {} {}] /Border [0 0 0] /A << /S /URI /URI ({}) >> >>",
                pdf_number(left), pdf_number(bottom), pdf_number(right), pdf_number(top), pdf_string(&link.url)
            ).into_bytes()));
            annotations.push(annotation_id);
        }
        page_records.push((page_id, image_id, content_id, annotations));
    }
    objects[0] = Some(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
    let kids = page_records
        .iter()
        .map(|record| format!("{} 0 R", record.0))
        .collect::<Vec<_>>()
        .join(" ");
    objects[1] =
        Some(format!("<< /Type /Pages /Count {} /Kids [{}] >>", pages.len(), kids).into_bytes());
    for (page, record) in pages.iter().zip(&page_records) {
        let annotations = if record.3.is_empty() {
            String::new()
        } else {
            format!(
                " /Annots [{}]",
                record
                    .3
                    .iter()
                    .map(|id| format!("{id} 0 R"))
                    .collect::<Vec<_>>()
                    .join(" ")
            )
        };
        objects[record.0 - 1] = Some(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /XObject << /Im{} {} 0 R >> >> /Contents {} 0 R{} >>",
            pdf_number(page.width_pt), pdf_number(page.height_pt), record.0, record.1, record.2, annotations
        ).into_bytes());
    }
    let object_count = objects.len();
    let mut pdf = b"%PDF-1.7\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = Vec::with_capacity(objects.len());
    for (index, object) in objects.into_iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
        pdf.extend_from_slice(&object.ok_or("PDF 生成失败。")?);
        pdf.extend_from_slice(b"\nendobj\n");
    }
    let xref = pdf.len();
    pdf.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", offsets.len() + 1).as_bytes(),
    );
    for offset in offsets {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
            object_count + 1
        )
        .as_bytes(),
    );
    Ok(pdf)
}

fn generate(
    input: &NativeExportRequest,
    paths: Vec<PathBuf>,
) -> Result<Vec<GeneratedFile>, String> {
    match input.format.as_str() {
        "json" => Ok(vec![GeneratedFile {
            path: paths[0].clone(),
            bytes: input
                .document_json
                .as_ref()
                .ok_or("导出数据无效。")?
                .as_bytes()
                .to_vec(),
        }]),
        "pdf" => Ok(vec![GeneratedFile {
            path: paths[0].clone(),
            bytes: build_pdf(&input.pages)?,
        }]),
        "svg" => input
            .pages
            .iter()
            .zip(paths)
            .map(|(page, path)| {
                parse_svg(&page.svg)?;
                Ok(GeneratedFile {
                    path,
                    bytes: page.svg.as_bytes().to_vec(),
                })
            })
            .collect(),
        "png" => input
            .pages
            .iter()
            .zip(paths)
            .map(|(page, path)| {
                let bytes = rasterize(page, input.dpi.ok_or("PNG DPI 无效。")?)?
                    .encode_png()
                    .map_err(|_| "PNG 生成失败。".to_owned())?;
                Ok(GeneratedFile { path, bytes })
            })
            .collect(),
        _ => Err("导出格式无效。".into()),
    }
}

fn rollback(staged: &mut [StagedFile]) {
    for file in staged.iter_mut().rev() {
        if file.installed {
            remove_regular_file(&file.target);
        }
        if let Some(backup) = &file.backup {
            if fs::symlink_metadata(&file.target).is_err() {
                let _ = fs::rename(backup, &file.target);
            }
        }
        remove_regular_file(&file.temporary);
    }
}

// Export targets may be absent or regular files. Directories and every symlink are rejected,
// including symlinks whose destination is a regular file, so transaction cleanup never moves them.
fn ensure_regular_file_or_missing(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() => Ok(()),
        Ok(_) => Err("导出目标必须是普通文件或不存在。".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("无法检查导出目标，原文件未受影响。".into()),
    }
}

fn remove_regular_file(path: &Path) {
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_file()) {
        let _ = fs::remove_file(path);
    }
}

fn commit_all_with_hook<F>(files: Vec<GeneratedFile>, mut before_commit: F) -> Result<(), String>
where
    F: FnMut(usize, &Path),
{
    for generated in &files {
        ensure_regular_file_or_missing(&generated.path)?;
    }
    let mut staged = Vec::with_capacity(files.len());
    for generated in files {
        let parent = generated.path.parent().ok_or("导出路径无效。")?;
        let name = generated
            .path
            .file_name()
            .ok_or("导出路径无效。")?
            .to_string_lossy();
        let temporary = parent.join(format!(".{name}.{}.tmp", Uuid::new_v4()));
        let mut handle = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "无法写入导出文件，原文件未受影响。".to_owned())?;
        if handle
            .write_all(&generated.bytes)
            .and_then(|_| handle.sync_all())
            .is_err()
        {
            let _ = fs::remove_file(&temporary);
            rollback(&mut staged);
            return Err("无法写入导出文件，原文件未受影响。".into());
        }
        staged.push(StagedFile {
            target: generated.path,
            temporary,
            backup: None,
            installed: false,
        });
    }
    for index in 0..staged.len() {
        before_commit(index, &staged[index].target);
        if let Err(error) = ensure_regular_file_or_missing(&staged[index].target) {
            rollback(&mut staged);
            return Err(error);
        }
        if fs::symlink_metadata(&staged[index].target).is_ok() {
            let parent = staged[index].target.parent().ok_or("导出路径无效。")?;
            let name = staged[index]
                .target
                .file_name()
                .ok_or("导出路径无效。")?
                .to_string_lossy();
            let backup = parent.join(format!(".{name}.{}.bak", Uuid::new_v4()));
            if fs::rename(&staged[index].target, &backup).is_err() {
                rollback(&mut staged);
                return Err("无法替换导出文件，原文件未受影响。".into());
            }
            staged[index].backup = Some(backup);
        }
        if fs::rename(&staged[index].temporary, &staged[index].target).is_err() {
            rollback(&mut staged);
            return Err("无法替换导出文件，原文件未受影响。".into());
        }
        staged[index].installed = true;
    }
    for file in &staged {
        if let Some(backup) = &file.backup {
            remove_regular_file(backup);
        }
    }
    Ok(())
}

fn commit_all(files: Vec<GeneratedFile>) -> Result<(), String> {
    commit_all_with_hook(files, |_, _| {})
}

pub fn export_request(input: NativeExportRequest) -> Result<Vec<String>, String> {
    validate_request(&input)?;
    let paths = output_paths(&input)?;
    let actual = paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    let generated = generate(&input, paths)?;
    commit_all(generated)?;
    Ok(actual)
}

#[tauri::command]
pub fn export_diagram(input: NativeExportRequest) -> Result<Vec<String>, String> {
    export_request(input)
}

#[cfg(test)]
mod tests {
    use super::{commit_all_with_hook, GeneratedFile};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn mid_commit_failure_restores_replaced_files_and_removes_every_staged_output() {
        let dir = tempdir().unwrap();
        let first = dir.path().join("first.svg");
        let second = dir.path().join("second.svg");
        fs::write(&first, b"old-first").unwrap();
        let files = vec![
            GeneratedFile {
                path: first.clone(),
                bytes: b"new-first".to_vec(),
            },
            GeneratedFile {
                path: second.clone(),
                bytes: b"new-second".to_vec(),
            },
        ];

        let result = commit_all_with_hook(files, |index, target| {
            if index == 1 {
                fs::create_dir(target).unwrap();
            }
        });

        assert_eq!(result.unwrap_err(), "导出目标必须是普通文件或不存在。");
        assert_eq!(fs::read(&first).unwrap(), b"old-first");
        assert!(second.is_dir());
        let names = fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(names.len(), 2);
        assert!(!names
            .iter()
            .any(|name| name.ends_with(".tmp") || name.ends_with(".bak")));
    }
}
