use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::{json, Value};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let backend = Backend::new(data_directory()).expect("backend initialization failed");
    let bootstrap = backend
        .execute(Command::Bootstrap)
        .await
        .expect("bootstrap failed");
    println!("signed_in={}", !bootstrap["account"].is_null());
    let history = backend
        .execute(Command::StateGet {
            key: "heybox.history".into(),
        })
        .await
        .expect("history unavailable");
    let ids = history
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_u64)
        .take(2)
        .collect::<Vec<_>>();
    if ids.is_empty() {
        println!("no_recent_posts=true");
        return;
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap();
    for id in ids {
        let cached = backend
            .execute(Command::LocalPosts { ids: vec![id] })
            .await
            .expect("cache unavailable");
        let images = cached[0]["images"].as_array().cloned().unwrap_or_default();
        println!(
            "post_id={id} cached_images={} cached_comment_count={}",
            images.len(),
            cached[0]["comments"].as_u64().unwrap_or(0)
        );
        let detail = match backend.execute(Command::Detail { id, page: 1 }).await {
            Ok(detail) => {
                let comments = detail["comments"].as_array().cloned().unwrap_or_default();
                println!(
                    "comment_metadata_check={}",
                    json!({"withLevel":comments.iter().filter(|c|c["level"].as_u64().unwrap_or(0)>0).count(),"pinned":comments.iter().filter(|c|c["pinned"]==true).count(),"previews":comments.iter().filter_map(|c|c["replies"].as_array()).map(Vec::len).sum::<usize>()})
                );
                if let Some(floor) = comments.iter().find(|c| c["hasMoreReplies"] == true) {
                    let root = floor["id"].as_u64().unwrap();
                    let mut cursor = floor["replies"]
                        .as_array()
                        .and_then(|a| a.last())
                        .and_then(|c| c["id"].as_u64())
                        .map(|id| id.to_string())
                        .unwrap_or_default();
                    for page in 1..=2 {
                        match backend
                            .execute(Command::SubComments {
                                root,
                                lastval: cursor.clone(),
                            })
                            .await
                        {
                            Ok(sub) => {
                                let list = sub["comments"].as_array().cloned().unwrap_or_default();
                                let next = sub["lastval"].as_str().unwrap_or_default().to_string();
                                println!(
                                    "reply_check={}",
                                    json!({"page":page,"ok":true,"count":list.len(),"rootPreserved":list.iter().all(|c|c["rootId"]==root),"cursorAdvanced":!next.is_empty()&&next!=cursor,"hasMore":sub["hasMore"]})
                                );
                                if sub["hasMore"] != true || next == cursor {
                                    break;
                                }
                                cursor = next;
                            }
                            Err(error) => {
                                println!("reply_check={}", json!({"ok":false,"code":error.code}));
                                break;
                            }
                        }
                    }
                }
                println!(
                    "detail_check={}",
                    json!({"ok":true,"hasPost":!detail["post"].is_null(),"images":detail["post"]["images"].as_array().map(Vec::len).unwrap_or(0),"comments":detail["comments"].as_array().map(Vec::len).unwrap_or(0),"bodyParts":detail["post"]["body"].as_array().map(Vec::len).unwrap_or(0),"hasMore":detail["hasMore"]})
                );
                Some(detail)
            }
            Err(error) => {
                println!(
                    "detail_check={}",
                    json!({"ok":false,"code":error.code,"message":error.message})
                );
                None
            }
        };
        let images = detail
            .as_ref()
            .and_then(|v| v["post"]["images"].as_array())
            .unwrap_or(&images);
        for image in images.iter().take(2).filter_map(Value::as_str) {
            let host = url::Url::parse(image)
                .ok()
                .and_then(|u| u.host_str().map(str::to_owned));
            match client.get(image).send().await {
                Ok(response) => println!(
                    "image_check={}",
                    json!({"host":host,"status":response.status().as_u16(),"contentType":response.headers().get("content-type").and_then(|v|v.to_str().ok())})
                ),
                Err(error) => println!(
                    "image_check={}",
                    json!({"host":host,"networkError":true,"timeout":error.is_timeout()})
                ),
            }
        }
        if detail.as_ref().is_some_and(|v| v["hasMore"] == true) {
            match backend.execute(Command::Detail { id, page: 2 }).await {
                Ok(next) => println!(
                    "next_page_check={}",
                    json!({"ok":true,"comments":next["comments"].as_array().map(Vec::len).unwrap_or(0),"hasMore":next["hasMore"]})
                ),
                Err(error) => println!("next_page_check={}", json!({"ok":false,"code":error.code})),
            }
        }
    }
}
