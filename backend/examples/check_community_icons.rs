use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::json;
#[tokio::main]
async fn main() {
    let backend = Backend::new(data_directory()).expect("backend unavailable");
    let result = backend
        .execute(Command::Communities {
            query: String::new(),
        })
        .await
        .expect("communities unavailable");
    let communities = result.as_array().unwrap();
    println!(
        "community_catalog={}",
        json!({"count":communities.len(),"missingIcon":communities.iter().filter(|c|c["icon"].as_str().unwrap_or_default().is_empty()).count()})
    );
    for c in communities.iter().take(7) {
        if let Some(url) = c["icon"].as_str().filter(|s| !s.is_empty()) {
            match reqwest::get(url).await {
                Ok(response) => println!(
                    "community_image_check={}",
                    json!({"status":response.status().as_u16(),"contentType":response.headers().get("content-type").and_then(|v|v.to_str().ok())})
                ),
                Err(_) => println!("community_image_check={}", json!({"networkError":true})),
            }
        }
    }
}
