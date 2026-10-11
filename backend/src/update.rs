use crate::error::{AppError, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

pub const UPDATE_URL: &str = "https://cjbtj.xyz/xiaoheihehe/api/version";
const DOWNLOAD_BASE: &str = "https://cjbtj.xyz/xiaoheihehe/releases/";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Release {
    version: String,
    notes: String,
    published_at: String,
    platform: String,
    download_url: String,
    sha256: String,
    size: u64,
}

fn version_parts(version: &str) -> Option<[u32; 3]> {
    let parts: Vec<_> = version.split('.').collect();
    if parts.len() != 3 { return None; }
    let mut result = [0; 3];
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty() || (part.len() > 1 && part.starts_with('0')) || !part.bytes().all(|b| b.is_ascii_digit()) { return None; }
        result[index] = part.parse().ok()?;
    }
    Some(result)
}

pub fn allowed_download_url(url: &str) -> bool {
    let Some(path) = url.strip_prefix(DOWNLOAD_BASE) else { return false; };
    let Some((version, name)) = path.split_once('/') else { return false; };
    version_parts(version).is_some() && name == format!("xiaoheihehe_{version}_x64-setup.exe")
}

fn release_info(bytes: &[u8], current: &str) -> Result<Value> {
    let invalid = || AppError::new("update", "更新信息无法识别，请稍后重试");
    let release: Release = serde_json::from_slice(bytes).map_err(|_| invalid())?;
    let latest = version_parts(&release.version).ok_or_else(invalid)?;
    let current_parts = version_parts(current).ok_or_else(invalid)?;
    if release.platform != "windows-x86_64" || release.size == 0 || release.size > 200 * 1024 * 1024
        || release.notes.len() > 16 * 1024 || release.published_at.len() > 64
        || release.sha256.len() != 64 || !release.sha256.bytes().all(|b| b.is_ascii_hexdigit())
        || release.download_url != format!("{DOWNLOAD_BASE}{}/xiaoheihehe_{}_x64-setup.exe", release.version, release.version) {
        return Err(invalid());
    }
    let mut value = serde_json::to_value(release).map_err(|_| invalid())?;
    value["currentVersion"] = current.into();
    value["available"] = (latest > current_parts).into();
    Ok(value)
}

pub async fn check() -> Result<Value> {
    // Separate client: update requests must never carry community cookies or account data.
    let client = Client::builder().timeout(Duration::from_secs(12)).connect_timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none()).build()
        .map_err(|_| AppError::new("update", "无法初始化更新检查"))?;
    let mut response = client.get(UPDATE_URL).header("Cache-Control", "no-cache").send().await
        .map_err(|_| AppError::new("update", "更新服务暂时无法连接，请稍后重试"))?;
    if !response.status().is_success() { return Err(AppError::new("update", "更新服务暂时不可用，请稍后重试")); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| AppError::new("update", "读取更新信息失败"))? {
        if bytes.len() + chunk.len() > 64 * 1024 { return Err(AppError::new("update", "更新信息过大")); }
        bytes.extend_from_slice(&chunk);
    }
    release_info(&bytes, env!("CARGO_PKG_VERSION"))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn manifest(version: &str) -> Value {
        serde_json::json!({"version":version,"notes":"更新说明","publishedAt":"2026-10-11T00:00:00Z","platform":"windows-x86_64","size":1234,"sha256":"a".repeat(64),"downloadUrl":format!("{DOWNLOAD_BASE}{version}/xiaoheihehe_{version}_x64-setup.exe")})
    }
    #[test]
    fn version_comparison_handles_equal_older_and_double_digits() {
        for (version, available) in [("0.1.1",false),("0.1.0",false),("0.1.10",true),("1.0.0",true)] {
            let result = release_info(&serde_json::to_vec(&manifest(version)).unwrap(), "0.1.1").unwrap();
            assert_eq!(result["available"], available);
        }
    }
    #[test]
    fn manifest_rejects_untrusted_downloads_and_invalid_metadata() {
        for (field, value) in [("downloadUrl", Value::from("https://evil.example/setup.exe")), ("sha256", Value::from("bad")), ("version",Value::from("../1.2.3")), ("size",Value::from(0)), ("platform",Value::from("linux"))] {
            let mut release = manifest("0.1.2"); release[field] = value;
            assert!(release_info(&serde_json::to_vec(&release).unwrap(),"0.1.1").is_err());
        }
        assert!(allowed_download_url(&manifest("0.1.2")["downloadUrl"].as_str().unwrap()));
        for url in ["http://cjbtj.xyz/xiaoheihehe/releases/0.1.2/xiaoheihehe_0.1.2_x64-setup.exe", "https://cjbtj.xyz.evil/xiaoheihehe/releases/0.1.2/xiaoheihehe_0.1.2_x64-setup.exe", "https://cjbtj.xyz/xiaoheihehe/releases/../setup.exe", "https://cjbtj.xyz/xiaoheihehe/releases/0.1.2/xiaoheihehe_0.1.2_x64-setup.exe?command=1"] {
            assert!(!allowed_download_url(url));
        }
    }
}
