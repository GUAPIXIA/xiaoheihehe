use heybox_backend::{storage::data_directory, Backend, Command};
use serde_json::{json, Value};
#[tokio::main]
async fn main() {
    let backend = Backend::new(data_directory()).expect("backend initialization failed");
    let history = backend
        .execute(Command::StateGet {
            key: "heybox.history".into(),
        })
        .await
        .expect("history unavailable");
    let id = history
        .as_array()
        .and_then(|a| a.first())
        .and_then(Value::as_u64)
        .expect("open a post first");
    let detail = backend
        .execute(Command::Detail { id, page: 1 })
        .await
        .expect("detail unavailable");
    let user = detail["post"]["userId"]
        .as_str()
        .expect("author missing")
        .to_string();
    let profile = backend
        .execute(Command::Profile { id: user.clone() })
        .await
        .expect("profile unavailable");
    println!(
        "profile_check={}",
        json!({"hasName":profile["name"].as_str().is_some_and(|s|!s.is_empty()),"hasAvatar":profile["avatarUrl"].as_str().is_some_and(|s|!s.is_empty()),"identityMatches":profile["id"]==user})
    );
    let mut cursor = String::new();
    for page in 1..=2 {
        let result = backend
            .execute(Command::UserPosts {
                id: user.clone(),
                lastval: cursor.clone(),
            })
            .await
            .expect("user posts unavailable");
        let list = result["posts"].as_array().unwrap();
        let next = result["lastval"].as_str().unwrap_or_default().to_string();
        println!(
            "user_posts_check={}",
            json!({"page":page,"count":list.len(),"hasMore":result["hasMore"],"cursorAdvanced":next!=cursor,"authorIdentityPresent":list.iter().all(|p|p["userId"].as_str().is_some_and(|s|!s.is_empty()))})
        );
        if result["hasMore"] != true {
            break;
        }
        cursor = next;
    }
}
