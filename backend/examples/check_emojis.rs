use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::json;
#[tokio::main]
async fn main() {
    let backend = Backend::new(data_directory()).expect("backend unavailable");
    let result = backend
        .execute(Command::Emojis)
        .await
        .expect("emoji request failed");
    let list = result["emojis"].as_array().expect("emoji catalog missing");
    println!(
        "emoji_catalog_check={}",
        json!({"count":list.len(),"hasVersion":result["version"].as_str().is_some_and(|s|!s.is_empty())})
    );
    for token in [
        "[cube_哭泣]",
        "[cube_喜歡]",
        "[cube_喜欢]",
        "[heygirl_无语]",
    ] {
        if let Some(emoji) = list.iter().find(|e| e["token"] == token) {
            let response = reqwest::get(emoji["url"].as_str().unwrap())
                .await
                .expect("emoji image unavailable");
            println!(
                "emoji_image_check={}",
                json!({"token":token,"status":response.status().as_u16(),"contentType":response.headers().get("content-type").and_then(|v|v.to_str().ok())})
            );
        }
    }
    let restored = Backend::new(data_directory())
        .expect("backend unavailable")
        .execute(Command::Emojis)
        .await
        .expect("cache unavailable");
    println!(
        "cache_restored={}",
        restored["version"] == result["version"] && restored["emojis"] == result["emojis"]
    );
}
