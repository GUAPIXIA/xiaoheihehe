// Read-only live check for comment images (post 194082427「泰拉梗图」).
//
// Performs NO write operations: only Bootstrap + Detail, plus plain HTTP GETs of the
// image URLs the backend reports. Asserts that `Comment.images` is populated for the
// user-reported comment (commentid 977357367) and that every reported URL is fetchable
// as an image (HTTP 200 + `content-type: image/*`).
use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::{json, Value};
use std::time::Duration;

const POST_ID: u64 = 194082427;
const TARGET_COMMENT_ID: u64 = 977357367;
const TARGET_TEXT: &str = "我这哥布林工匠还有四颗魔丸守护";

// Floors plus their nested reply previews.
fn flatten<'a>(comments: &'a [Value], out: &mut Vec<&'a Value>) {
    for comment in comments {
        out.push(comment);
        if let Some(replies) = comment["replies"].as_array() {
            flatten(replies, out);
        }
    }
}

fn images_of(comment: &Value) -> Vec<&str> {
    comment["images"]
        .as_array()
        .map(|list| list.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default()
}

#[tokio::main]
async fn main() {
    let mut failures = 0usize;
    let backend = Backend::new(data_directory()).expect("backend initialization failed");
    let bootstrap = backend
        .execute(Command::Bootstrap)
        .await
        .expect("bootstrap failed");
    let signed_in = !bootstrap["account"].is_null();
    println!("signed_in={signed_in}");

    let detail = match backend.execute(Command::Detail { id: POST_ID, page: 1 }).await {
        Ok(detail) => detail,
        Err(error) => {
            println!(
                "detail_check={}",
                json!({"ok": false, "code": error.code, "message": error.message})
            );
            println!(
                "comment_images_check={}",
                json!({"ok": false, "reason": "detail request failed"})
            );
            std::process::exit(1);
        }
    };

    let floors = detail["comments"].as_array().cloned().unwrap_or_default();
    let mut all = vec![];
    flatten(&floors, &mut all);
    println!(
        "detail_check={}",
        json!({
            "ok": !detail["post"].is_null(),
            "postId": POST_ID,
            "floorCount": floors.len(),
            "commentCount": all.len(),
            "hasMore": detail["hasMore"],
        })
    );

    let target = all
        .iter()
        .find(|c| c["id"].as_u64() == Some(TARGET_COMMENT_ID))
        .or_else(|| {
            all.iter()
                .find(|c| c["text"].as_str().is_some_and(|t| t.contains(TARGET_TEXT)))
        });
    let Some(target) = target else {
        println!("target_comment={}", json!({"found": false}));
        println!(
            "comment_images_check={}",
            json!({"ok": false, "reason": "target comment not found on page 1"})
        );
        std::process::exit(1);
    };

    let text = target["text"].as_str().unwrap_or_default().to_owned();
    let images = images_of(target);
    if target["id"].as_u64() != Some(TARGET_COMMENT_ID) {
        failures += 1;
        println!(
            "target_id_check={}",
            json!({"ok": false, "expected": TARGET_COMMENT_ID, "actual": target["id"]})
        );
    }
    if !text.contains(TARGET_TEXT) {
        failures += 1;
    }
    if images.is_empty() {
        failures += 1;
    }
    println!(
        "target_comment={}",
        json!({
            "found": true,
            "id": target["id"],
            "author": target["author"],
            "text": text,
            "textMatches": text.contains(TARGET_TEXT),
            "imageCount": images.len(),
        })
    );
    println!(
        "images_present_check={}",
        json!({"ok": !images.is_empty(), "imageCount": images.len()})
    );

    let with_images = all.iter().filter(|c| !images_of(c).is_empty()).count();
    println!(
        "page_comment_stats={}",
        json!({
            "comments": all.len(),
            "withImages": with_images,
            "withoutImages": all.len() - with_images,
            "floors": floors.len(),
        })
    );

    // Every image the target reports must actually be fetchable as an image.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap();
    for url in &images {
        let host = url::Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(str::to_owned));
        match client.get(*url).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or_default()
                    .to_owned();
                let ok = status == 200 && content_type.starts_with("image/");
                if !ok {
                    failures += 1;
                }
                println!(
                    "target_image_check={}",
                    json!({"ok": ok, "host": host, "status": status, "contentType": content_type, "url": url})
                );
            }
            Err(error) => {
                failures += 1;
                println!(
                    "target_image_check={}",
                    json!({"ok": false, "host": host, "networkError": true, "timeout": error.is_timeout(), "url": url})
                );
            }
        }
    }

    // Sample the other image-bearing comments on the same page (bounded, read-only).
    let mut sampled = 0;
    for comment in all.iter().filter(|c| c["id"] != target["id"]) {
        let urls = images_of(comment);
        if urls.is_empty() || sampled >= 2 {
            continue;
        }
        sampled += 1;
        let url = urls[0];
        match client.get(url).send().await {
            Ok(response) => println!(
                "other_comment_image_check={}",
                json!({
                    "commentId": comment["id"],
                    "author": comment["author"],
                    "imageCount": urls.len(),
                    "status": response.status().as_u16(),
                    "contentType": response.headers().get("content-type").and_then(|v| v.to_str().ok()),
                })
            ),
            Err(error) => println!(
                "other_comment_image_check={}",
                json!({"commentId": comment["id"], "imageCount": urls.len(), "networkError": true, "timeout": error.is_timeout()})
            ),
        }
    }

    println!(
        "comment_images_check={}",
        json!({"ok": failures == 0, "postId": POST_ID, "failures": failures, "signedIn": signed_in, "targetImageCount": images.len(), "pageWithImages": with_images})
    );
    if failures > 0 {
        std::process::exit(1);
    }
}
