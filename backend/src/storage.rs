use crate::error::{AppError, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

pub struct Storage {
    connection: Mutex<Connection>,
    pub directory: PathBuf,
}
impl Storage {
    pub fn open(directory: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&directory).map_err(|_| AppError::storage())?;
        let db = Connection::open(directory.join("community.sqlite3"))
            .map_err(|_| AppError::storage())?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);").map_err(|_| AppError::storage())?;
        Ok(Self {
            connection: Mutex::new(db),
            directory,
        })
    }
    pub fn get(&self, key: &str) -> Result<Option<Value>> {
        let db = self.connection.lock().map_err(|_| AppError::storage())?;
        let text: Option<String> = db
            .query_row("SELECT value FROM state WHERE key=?1", [key], |r| r.get(0))
            .optional()
            .map_err(|_| AppError::storage())?;
        text.map(|s| serde_json::from_str(&s).map_err(|_| AppError::storage()))
            .transpose()
    }
    pub fn set(&self, key: &str, value: &Value) -> Result<()> {
        self.connection.lock().map_err(|_| AppError::storage())?.execute("INSERT INTO state(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key, value.to_string()]).map_err(|_| AppError::storage())?;
        Ok(())
    }
    pub fn cache(&self, key: &str, value: &Value) -> Result<()> {
        let db = self.connection.lock().map_err(|_| AppError::storage())?;
        db.execute("INSERT INTO cache(key,value,updated) VALUES(?1,?2,unixepoch()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated", params![key, value.to_string()]).map_err(|_| AppError::storage())?;
        // Keep up to 1500 post snapshots, enough for saved items and recent history.
        db.execute("DELETE FROM cache WHERE key LIKE 'post:%' AND key NOT IN (SELECT key FROM cache WHERE key LIKE 'post:%' ORDER BY updated DESC LIMIT 1500) AND key NOT IN (SELECT 'post:' || value FROM json_each(COALESCE((SELECT value FROM state WHERE key='heybox.bookmarks'),'[]')))", []).map_err(|_| AppError::storage())?;
        Ok(())
    }
    pub fn cached(&self, key: &str, max_age: u64) -> Result<Option<Value>> {
        let db = self.connection.lock().map_err(|_| AppError::storage())?;
        let text: Option<String> = db
            .query_row(
                "SELECT value FROM cache WHERE key=?1 AND updated >= unixepoch()-?2",
                params![key, max_age],
                |r| r.get(0),
            )
            .optional()
            .map_err(|_| AppError::storage())?;
        text.map(|s| serde_json::from_str(&s).map_err(|_| AppError::storage()))
            .transpose()
    }
    pub fn clear_account_cache(&self) -> Result<()> {
        let db = self.connection.lock().map_err(|_| AppError::storage())?;
        db.execute("DELETE FROM cache WHERE key NOT LIKE 'post:%'", [])
            .map_err(|_| AppError::storage())?;
        db.execute("UPDATE cache SET value=json_set(value,'$.liked',json('false')) WHERE key LIKE 'post:%'", []).map_err(|_| AppError::storage())?;
        Ok(())
    }
}

pub fn data_directory() -> PathBuf {
    if cfg!(debug_assertions) {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data");
    }
    let beside = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("data")));
    if let Some(path) = beside {
        if std::fs::create_dir_all(&path).is_ok() {
            let probe = path.join(".write-test");
            if std::fs::write(&probe, b"").is_ok() {
                let _ = std::fs::remove_file(probe);
                return path;
            }
        }
    }
    PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap_or_else(|| ".".into()))
        .join("HeyboxCommunity/data")
}

// DPAPI encrypts login secrets for the current Windows user. Secrets never enter frontend state.
#[cfg(windows)]
mod dpapi {
    use super::*;
    #[repr(C)]
    struct Blob {
        size: u32,
        bytes: *mut u8,
    }
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            input: *const Blob,
            description: *const u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const Blob,
            description: *mut *mut u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(memory: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    }
    pub fn transform(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>> {
        let input = Blob {
            size: bytes.len().try_into().map_err(|_| AppError::storage())?,
            bytes: bytes.as_ptr() as *mut _,
        };
        let mut output = Blob {
            size: 0,
            bytes: std::ptr::null_mut(),
        };
        unsafe {
            let ok = if encrypt {
                CryptProtectData(
                    &input,
                    std::ptr::null(),
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    1,
                    &mut output,
                )
            } else {
                CryptUnprotectData(
                    &input,
                    std::ptr::null_mut(),
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    1,
                    &mut output,
                )
            };
            if ok == 0 {
                return Err(AppError::new(
                    "credentials",
                    "无法解密登录信息，请重新扫码登录",
                ));
            }
            let result = std::slice::from_raw_parts(output.bytes, output.size as usize).to_vec();
            for i in 0..output.size as usize {
                std::ptr::write_volatile(output.bytes.add(i), 0);
            }
            LocalFree(output.bytes.cast());
            Ok(result)
        }
    }
}
pub fn load_credentials(path: &Path) -> Result<Option<Value>> {
    if !path.exists() {
        return Ok(None);
    }
    #[cfg(windows)]
    {
        let bytes = std::fs::read(path).map_err(|_| AppError::storage())?;
        let plain = dpapi::transform(&bytes, false)?;
        return serde_json::from_slice(&plain)
            .map(Some)
            .map_err(|_| AppError::storage());
    }
    #[cfg(not(windows))]
    {
        Err(AppError::new("platform", "登录凭据仅支持 Windows"))
    }
}
pub fn save_credentials(path: &Path, value: &Value) -> Result<()> {
    #[cfg(windows)]
    {
        let bytes = dpapi::transform(value.to_string().as_bytes(), true)?;
        std::fs::write(path, bytes).map_err(|_| AppError::storage())
    }
    #[cfg(not(windows))]
    {
        let _ = (path, value);
        Err(AppError::new("platform", "登录凭据仅支持 Windows"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn durable_state_and_cache() {
        let dir = std::env::temp_dir().join(format!("heybox-test-{}", uuid::Uuid::new_v4()));
        let db = Storage::open(dir.clone()).unwrap();
        db.set("prefs", &serde_json::json!({"zoom":125})).unwrap();
        db.cache("post:1", &serde_json::json!({"id":1})).unwrap();
        drop(db);
        let db = Storage::open(dir.clone()).unwrap();
        assert_eq!(db.get("prefs").unwrap().unwrap()["zoom"], 125);
        assert!(db.cached("post:1", 3600).unwrap().is_some());
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    #[cfg(windows)]
    fn encrypted_credentials_roundtrip() {
        let input = b"test-only-secret";
        let encrypted = dpapi::transform(input, true).unwrap();
        assert!(!encrypted.windows(input.len()).any(|p| p == input));
        assert_eq!(dpapi::transform(&encrypted, false).unwrap(), input);
    }
}
