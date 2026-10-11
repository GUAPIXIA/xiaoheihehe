use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    routing::post,
    Json, Router,
};
use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::{json, Value};
use std::sync::Arc;

async fn command(
    State(backend): State<Arc<Backend>>,
    headers: HeaderMap,
    Json(request): Json<Command>,
) -> (StatusCode, Json<Value>) {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if headers.get("x-heybox-client").and_then(|v| v.to_str().ok()) != Some("desktop-preview")
        || !["http://127.0.0.1:5173", "http://localhost:5173"].contains(&origin)
        || host != "127.0.0.1:38741"
    {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"error":{"code":"forbidden","message":"请求来源无效"}})),
        );
    }
    match backend.execute(request).await {
        Ok(data) => (StatusCode::OK, Json(json!({"ok":true,"data":data}))),
        Err(error) => (StatusCode::OK, Json(json!({"ok":false,"error":error}))),
    }
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let backend = Arc::new(Backend::new(data_directory()).map_err(|e| e.message)?);
    let app = Router::new()
        .route("/api/command", post(command))
        .layer(DefaultBodyLimit::max(128 * 1024))
        .with_state(backend);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:38741").await?;
    println!("本地后端已启动：http://127.0.0.1:38741（仅开发预览）");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
