use heybox_backend::{storage::data_directory, Backend, Command};

#[tokio::main]
async fn main() {
    let backend = Backend::new(data_directory()).expect("backend initialization failed");
    let bootstrap = backend
        .execute(Command::Bootstrap)
        .await
        .expect("bootstrap failed");
    let account = &bootstrap["account"];
    assert!(!account.is_null(), "Sign in before running this check");
    let profile = backend
        .execute(Command::Profile {
            id: account["id"]
                .as_str()
                .expect("missing account ID")
                .to_owned(),
        })
        .await
        .expect("profile request failed");
    let has_avatar = |value: &serde_json::Value| {
        value["avatarUrl"]
            .as_str()
            .is_some_and(|url| url.starts_with("https://"))
    };
    println!(
        "signed_in=true bootstrap_has_avatar={} profile_has_avatar={}",
        has_avatar(account),
        has_avatar(&profile)
    );
    assert!(
        has_avatar(account),
        "Saved login account is missing its profile avatar"
    );
    let response = reqwest::get(account["avatarUrl"].as_str().unwrap())
        .await
        .expect("avatar request failed");
    assert!(
        response.status().is_success(),
        "avatar image request failed"
    );
    assert!(
        response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.starts_with("image/")),
        "avatar response is not an image"
    );
    let restored = Backend::new(data_directory()).expect("restored backend initialization failed");
    let restored_account = restored
        .execute(Command::Bootstrap)
        .await
        .expect("restored bootstrap failed");
    assert_eq!(
        restored_account["account"]["avatarUrl"],
        account["avatarUrl"]
    );
    println!("avatar_image_ok=true avatar_persisted=true");
}
