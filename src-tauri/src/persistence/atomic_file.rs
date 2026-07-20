use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum AtomicFileError {
    #[error("无法保存，原文件未被覆盖。")]
    Io(#[from] io::Error),
}

struct TemporaryFile {
    path: PathBuf,
    moved: bool,
}

impl Drop for TemporaryFile {
    fn drop(&mut self) {
        if !self.moved {
            let _ = fs::remove_file(&self.path);
        }
    }
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), AtomicFileError> {
    atomic_write_with_replacer(path, bytes, replace_file)
}

fn atomic_write_with_replacer<F>(
    path: &Path,
    bytes: &[u8],
    replacer: F,
) -> Result<(), AtomicFileError>
where
    F: FnOnce(&Path, &Path) -> io::Result<()>,
{
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "目标路径没有父目录"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "目标路径没有文件名"))?;
    let temporary_path = parent.join(format!(
        ".{}.{}.tmp",
        file_name.to_string_lossy(),
        Uuid::new_v4()
    ));
    let mut temporary = TemporaryFile {
        path: temporary_path,
        moved: false,
    };
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary.path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);

    replacer(&temporary.path, path)?;
    temporary.moved = true;
    sync_parent_directory(parent)?;
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(temporary: &Path, target: &Path) -> io::Result<()> {
    fs::rename(temporary, target)
}

#[cfg(windows)]
fn replace_file(temporary: &Path, target: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, MOVEFILE_WRITE_THROUGH, REPLACEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    let temporary = wide(temporary);
    let target_wide = wide(target);
    let succeeded = unsafe {
        if target.exists() {
            ReplaceFileW(
                target_wide.as_ptr(),
                temporary.as_ptr(),
                std::ptr::null(),
                REPLACEFILE_WRITE_THROUGH,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        } else {
            MoveFileExW(
                temporary.as_ptr(),
                target_wide.as_ptr(),
                MOVEFILE_WRITE_THROUGH,
            )
        }
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) -> io::Result<()> {
    fs::File::open(parent)?.sync_all()
}

#[cfg(not(unix))]
fn sync_parent_directory(_parent: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{fs, io, path::Path};

    use tempfile::tempdir;

    use super::{atomic_write, atomic_write_with_replacer};

    fn temporary_files(parent: &Path) -> Vec<String> {
        fs::read_dir(parent)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect()
    }

    #[test]
    fn writes_new_file_and_round_trips_chinese_json() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("中文流程.flowdiagram");
        let bytes = r#"{"schemaVersion":1,"name":"审批流程"}"#.as_bytes();

        atomic_write(&path, bytes).unwrap();

        assert_eq!(fs::read(path).unwrap(), bytes);
        assert!(temporary_files(dir.path()).is_empty());
    }

    #[test]
    fn atomically_overwrites_an_existing_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("diagram.flowdiagram");
        fs::write(&path, b"old").unwrap();

        atomic_write(&path, b"new").unwrap();

        assert_eq!(fs::read(path).unwrap(), b"new");
        assert!(temporary_files(dir.path()).is_empty());
    }

    #[test]
    fn replace_failure_preserves_original_and_removes_temporary_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("diagram.flowdiagram");
        fs::write(&path, b"old").unwrap();

        let result = atomic_write_with_replacer(&path, b"new", |_temporary, _target| {
            Err(io::Error::new(
                io::ErrorKind::Other,
                "injected replace failure",
            ))
        });

        assert!(result.is_err());
        assert_eq!(fs::read(path).unwrap(), b"old");
        assert!(temporary_files(dir.path()).is_empty());
    }
}
