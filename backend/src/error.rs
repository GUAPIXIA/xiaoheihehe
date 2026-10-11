use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub official_url: Option<String>,
}
pub type Result<T> = std::result::Result<T, AppError>;
impl AppError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            official_url: None,
        }
    }
    pub fn storage() -> Self {
        Self::new("storage", "本地数据读写失败，请检查目录权限或磁盘空间")
    }
    pub fn invalid() -> Self {
        Self::new("invalid", "请求参数不正确")
    }
}
