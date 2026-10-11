use crate::{
    error::{AppError, Result},
    model::{self, Filter, Post},
    signing,
    storage::{self, Storage},
};
use futures_util::{stream, StreamExt};
use reqwest::{
    cookie::{CookieStore, Jar},
    Client, Method,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::PathBuf,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::{Mutex, RwLock};

const BASE: &str = "https://api.xiaoheihe.cn";
const OFFICIAL: &str = "https://xiaoheihe.cn/app/bbs/home";
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn client(jar: Arc<Jar>) -> Result<Client> {
    Client::builder().cookie_provider(jar).timeout(Duration::from_secs(20)).connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36")
        .build().map_err(|_|AppError::new("network","无法初始化网络连接"))
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    content = "payload",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    Bootstrap,
    Emojis,
    StateGet {
        key: String,
    },
    StateSet {
        key: String,
        value: Value,
    },
    Communities {
        #[serde(default)]
        query: String,
    },
    Feed(FeedRequest),
    LocalPosts {
        ids: Vec<u64>,
    },
    Detail {
        id: u64,
        #[serde(default = "one")]
        page: u32,
    },
    SubComments {
        root: u64,
        #[serde(default)]
        lastval: String,
    },
    Profile {
        id: String,
    },
    UserPosts {
        id: String,
        #[serde(default)]
        lastval: String,
    },
    QrStart,
    QrPoll {
        session: String,
    },
    QrCancel {
        session: String,
    },
    Logout,
    Like {
        id: u64,
        liked: bool,
    },
    Comment {
        id: u64,
        text: String,
        #[serde(default)]
        reply: Option<u64>,
        #[serde(default)]
        root: Option<u64>,
        #[serde(default)]
        is_cy: bool,
    },
}
fn one() -> u32 {
    1
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Cursor {
    pub offset: u32,
    pub topics: BTreeMap<u64, u32>,
    pub exhausted: Vec<u64>,
    pub rotation: usize,
}
#[derive(Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FeedRequest {
    pub cursor: Cursor,
    pub filter: Filter,
    pub topic: Option<u64>,
    pub query: String,
    pub tab: String,
    pub width: u32,
}
impl Default for FeedRequest {
    fn default() -> Self {
        Self {
            cursor: Cursor::default(),
            filter: Filter {
                mode: "all".into(),
                unknown: true,
                ..Default::default()
            },
            topic: None,
            query: String::new(),
            tab: "推荐".into(),
            width: 604,
        }
    }
}
struct QrSession {
    query: Vec<(String, String)>,
    expires: u64,
    last_poll: u64,
    jar: Arc<Jar>,
    client: Client,
}
pub struct Backend {
    pub storage: Storage,
    client: Client,
    jar: Arc<Jar>,
    device: String,
    account: RwLock<Value>,
    qr: Mutex<HashMap<String, QrSession>>,
    limiter: Mutex<tokio::time::Instant>,
    auth_lock: Mutex<()>,
}
impl Backend {
    pub fn new(directory: PathBuf) -> Result<Self> {
        let storage = Storage::open(directory)?;
        let device = storage
            .get("device")?
            .and_then(|v| v.as_str().map(str::to_owned))
            .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
        storage.set("device", &json!(device))?;
        let jar = Arc::new(Jar::default());
        let saved =
            storage::load_credentials(&storage.directory.join("credentials.dat")).unwrap_or(None);
        let mut account = json!(null);
        if let Some(saved) = saved {
            let cookie = model::text(&saved["cookie"]);
            for pair in cookie.split("; ").filter(|p| p.contains('=')) {
                jar.add_cookie_str(
                    &format!("{pair}; Path=/; Secure; HttpOnly"),
                    &url::Url::parse(BASE).unwrap(),
                );
            }
            account = saved["account"].clone();
        }
        Ok(Self {
            client: client(jar.clone())?,
            jar,
            storage,
            device,
            account: RwLock::new(account),
            qr: Mutex::new(HashMap::new()),
            limiter: Mutex::new(tokio::time::Instant::now()),
            auth_lock: Mutex::new(()),
        })
    }
    async fn throttle(&self) {
        let mut next = self.limiter.lock().await;
        tokio::time::sleep_until(*next).await;
        *next = tokio::time::Instant::now() + Duration::from_millis(300);
    }
    async fn request(
        &self,
        path: &str,
        query: Vec<(String, String)>,
        body: Option<Vec<(String, String)>>,
        alternate: Option<&Client>,
    ) -> Result<Value> {
        self.throttle().await;
        let ts = now();
        let nonce = format!(
            "{:X}",
            md5::compute(format!("{ts}{}", uuid::Uuid::new_v4()))
        );
        let mut params: Vec<(String, String)> = [
            ("os_type", "web"),
            ("app", "heybox"),
            ("client_type", "web"),
            ("version", "999.0.4"),
            ("web_version", "3.0"),
            ("x_client_type", "web"),
            ("x_app", "heybox_website"),
            ("x_os_type", "Windows"),
            ("device_info", "Chrome"),
            ("_notip", "true"),
        ]
        .into_iter()
        .map(|(k, v)| (k.into(), v.into()))
        .collect();
        params.extend([
            ("device_id".into(), self.device.clone()),
            ("hkey".into(), signing::signature(path, ts + 1, &nonce)),
            ("_time".into(), ts.to_string()),
            ("nonce".into(), nonce.clone()),
        ]);
        if alternate.is_none() {
            let account = self.account.read().await;
            if let Some(id) = account["id"].as_str() {
                params.push(("heybox_id".into(), id.into()));
            }
        }
        if path == "/bbs/app/comment/create" {
            params.push(("_rnd".into(), signing::comment_signature(ts, &nonce)));
        }
        // Endpoint arguments override shared defaults, including app=web for QR login.
        for (key, value) in query {
            params.retain(|(name, _)| name != &key);
            params.push((key, value));
        }
        let mut builder = alternate
            .unwrap_or(&self.client)
            .request(
                if body.is_some() {
                    Method::POST
                } else {
                    Method::GET
                },
                format!("{BASE}{path}"),
            )
            .header("Referer", "https://www.xiaoheihe.cn/")
            .header("Origin", "https://www.xiaoheihe.cn")
            .query(&params);
        if let Some(body) = body {
            builder = builder.form(&body);
        }
        let response = builder.send().await.map_err(|e| {
            AppError::new(
                "network",
                if e.is_timeout() {
                    "请求超时，请稍后重试"
                } else {
                    "无法连接小黑盒，请检查网络后重试"
                },
            )
        })?;
        if !response.status().is_success() {
            return Err(AppError::new(
                "http",
                format!("服务器暂不可用（{}）", response.status().as_u16()),
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|_| AppError::new("network", "读取响应失败"))?;
        if bytes.len() > 12 * 1024 * 1024 {
            return Err(AppError::new("response", "响应数据过大"));
        }
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|_| AppError::new("response", "服务器返回了无法识别的数据"))?;
        if let Err(error) = check_status(&value) {
            if error.code == "login" && alternate.is_none() {
                *self.account.write().await = Value::Null;
            }
            return Err(error);
        }
        Ok(value.get("result").cloned().unwrap_or(value))
    }
    async fn require_login(&self) -> Result<()> {
        if self.account.read().await.is_null() {
            return Err(AppError::new("login", "请先使用小黑盒 App 扫码登录"));
        }
        Ok(())
    }
    async fn user_profile(&self, id: &str) -> Result<Value> {
        if id.len() > 20 || !id.chars().all(|c| c.is_ascii_digit()) || id.is_empty() {
            return Err(AppError::invalid());
        }
        let result = self
            .request(
                "/bbs/app/profile/user/profile",
                vec![("userid".into(), id.into())],
                None,
                None,
            )
            .await?;
        let user = &result["account_detail"];
        let returned_id = model::text(&user["userid"]);
        if !user.is_object() || (!returned_id.is_empty() && returned_id != id) {
            return Err(AppError::new("response", "用户资料无法识别，请稍后重试"));
        }
        Ok(public_account(user, id))
    }
    async fn complete_account_profile(&self) -> Result<Value> {
        let current = self.account.read().await.clone();
        if current.is_null() || !model::text(&current["avatarUrl"]).is_empty() {
            return Ok(current);
        }
        // Serialize enrichment with login/logout so it cannot revive a signed-out account.
        let _guard = self.auth_lock.lock().await;
        let current = self.account.read().await.clone();
        if current.is_null() || !model::text(&current["avatarUrl"]).is_empty() {
            return Ok(current);
        }
        let profile = self.user_profile(&model::text(&current["id"])).await?;
        let account = merge_account_profile(&current, &profile);
        let path = self.storage.directory.join("credentials.dat");
        let mut saved = storage::load_credentials(&path)?.ok_or_else(AppError::storage)?;
        if saved["account"]["id"] != current["id"] {
            return Err(AppError::storage());
        }
        saved["account"] = account.clone();
        storage::save_credentials(&path, &saved)?;
        *self.account.write().await = account.clone();
        Ok(account)
    }
    pub async fn execute(&self, command: Command) -> Result<Value> {
        match command {
            Command::Emojis => {
                if let Some(cached) = self.storage.cached("emojis", 24 * 3600)? {
                    return Ok(cached);
                }
                match self
                    .request("/bbs/app/api/emojis/list", vec![], None, None)
                    .await
                {
                    Ok(raw) => {
                        let result = model::emojis(&raw);
                        if result["emojis"].as_array().is_none_or(|a| a.is_empty()) {
                            return Err(AppError::new("response", "暂时无法读取表情目录"));
                        }
                        self.storage.cache("emojis", &result)?;
                        Ok(result)
                    }
                    Err(error) => self.storage.cached("emojis", 365 * 24 * 3600)?.ok_or(error),
                }
            }
            Command::Bootstrap => {
                // Optional profile requests must not make an existing login disappear
                // when the network or profile endpoint is temporarily unavailable.
                let account = match self.complete_account_profile().await {
                    Ok(account) => account,
                    Err(_) => self.account.read().await.clone(),
                };
                let mut states = serde_json::Map::new();
                for key in STATE_KEYS {
                    if let Some(value) = self.storage.get(key)? {
                        states.insert(key.to_string(), value);
                    }
                }
                Ok(
                    json!({"account":account,"states":states,"dataDirectory":self.storage.directory.to_string_lossy(),"version":"0.1.0"}),
                )
            }
            Command::StateGet { key } => {
                validate_key(&key)?;
                Ok(self.storage.get(&key)?.unwrap_or(Value::Null))
            }
            Command::StateSet { key, value } => {
                validate_state(&key, &value)?;
                self.storage.set(&key, &value)?;
                Ok(json!(true))
            }
            Command::Communities { query } => {
                if query.len() > 256 {
                    return Err(AppError::invalid());
                }
                if query.trim().is_empty() {
                    if let Some(cached) = self.storage.cached("communities-icons-v3", 6 * 3600)? {
                        return Ok(cached);
                    }
                    let result = self
                        .request("/bbs/app/topic/categories", vec![], None, None)
                        .await?;
                    let result = json!(model::communities(&result));
                    self.storage.cache("communities-icons-v3", &result)?;
                    Ok(result)
                } else {
                    let result = self
                        .request(
                            "/bbs/app/api/post_editor/topic_selection/search",
                            vec![("q".into(), query), ("only_hashtag".into(), "0".into())],
                            None,
                            None,
                        )
                        .await?;
                    let valid: Vec<Value> = result["search_result"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter(|v| v["search_type"] == "topic")
                                .cloned()
                                .collect()
                        })
                        .unwrap_or_default();
                    Ok(json!(model::communities(&json!(valid))))
                }
            }
            Command::Feed(request) => self.feed(request).await,
            Command::LocalPosts { ids } => {
                if ids.len() > 500 {
                    return Err(AppError::invalid());
                }
                let mut out = vec![];
                for id in ids {
                    if let Some(v) = self
                        .storage
                        .cached(&format!("post:{id}"), 365 * 24 * 3600)?
                    {
                        out.push(v);
                    }
                }
                Ok(json!(out))
            }
            Command::Detail { id, page } => {
                if id == 0 || page == 0 || page > 1000 {
                    return Err(AppError::invalid());
                }
                let path = "/bbs/app/link/tree";
                let result = self
                    .request(
                        path,
                        vec![
                            ("link_id".into(), id.to_string()),
                            ("page".into(), page.to_string()),
                            ("is_first".into(), if page == 1 { "1" } else { "0" }.into()),
                            ("index".into(), "1".into()),
                            ("limit".into(), "20".into()),
                            ("owner_only".into(), "0".into()),
                        ],
                        None,
                        None,
                    )
                    .await
                    .map_err(|mut e| {
                        if e.code == "show_captcha" {
                            e.official_url =
                                Some(format!("https://xiaoheihe.cn/app/bbs/link/{id}"));
                        }
                        e
                    })?;
                let post = model::post(&result["link"]);
                if let Some(p) = &post {
                    self.storage.cache(&format!("post:{id}"), &json!(p))?;
                }
                Ok(
                    json!({"post":post,"comments":model::comments(&result),"hasMore":model::yes(&result["has_more_floors"]),"page":page,"isCy":model::yes(&result["is_cy"])}),
                )
            }
            Command::SubComments { root, lastval } => {
                if root == 0 || lastval.len() > 100 {
                    return Err(AppError::invalid());
                }
                let result = self
                    .request(
                        "/bbs/app/comment/sub/comments",
                        vec![
                            ("root_comment_id".into(), root.to_string()),
                            ("lastval".into(), lastval),
                        ],
                        None,
                        None,
                    )
                    .await?;
                let mut comments = model::comments(&result);
                for comment in &mut comments {
                    comment.root_id = root;
                }
                let lastval = model::text(&result["lastval"]);
                let lastval = if lastval.is_empty() {
                    comments
                        .last()
                        .map(|c| c.id.to_string())
                        .unwrap_or_default()
                } else {
                    lastval
                };
                Ok(
                    json!({"comments":comments,"hasMore":model::yes(&result["has_more"]),"lastval":lastval}),
                )
            }
            Command::Profile { id } => self.user_profile(&id).await,
            Command::UserPosts { id, lastval } => {
                if id.is_empty()
                    || id.len() > 20
                    || !id.chars().all(|c| c.is_ascii_digit())
                    || lastval.len() > 100
                {
                    return Err(AppError::invalid());
                }
                let result = self
                    .request(
                        "/bbs/app/profile/events",
                        vec![
                            ("list_type".into(), "moment".into()),
                            ("userid".into(), id.clone()),
                            ("dw".into(), "604".into()),
                            ("lastval".into(), lastval.clone()),
                        ],
                        None,
                        None,
                    )
                    .await?;
                let mut posts = model::posts(&result);
                for post in &mut posts {
                    if post.user_id.is_empty() {
                        post.user_id = id.clone();
                    }
                    self.storage
                        .cache(&format!("post:{}", post.id), &json!(post))?;
                }
                let next = model::text(&result["lastval"]);
                let has_more = !next.is_empty()
                    && next != lastval
                    && result["moments"].as_array().is_some_and(|a| !a.is_empty())
                    && result.get("has_more").map(model::yes).unwrap_or(true);
                Ok(json!({"posts":posts,"lastval":next,"hasMore":has_more}))
            }
            Command::QrStart => self.qr_start().await,
            Command::QrPoll { session } => self.qr_poll(&session).await,
            Command::QrCancel { session } => {
                self.qr.lock().await.remove(&session);
                Ok(json!(true))
            }
            Command::Logout => {
                let _guard = self.auth_lock.lock().await;
                let path = self.storage.directory.join("credentials.dat");
                if path.exists() {
                    std::fs::remove_file(path).map_err(|_| AppError::storage())?;
                }
                let url = url::Url::parse(BASE).unwrap();
                if let Some(header) = self.jar.cookies(&url) {
                    for pair in header.to_str().unwrap_or("").split("; ") {
                        if let Some((name, _)) = pair.split_once('=') {
                            self.jar
                                .add_cookie_str(&format!("{name}=; Max-Age=0; Path=/"), &url);
                            self.jar.add_cookie_str(
                                &format!("{name}=; Max-Age=0; Domain=.xiaoheihe.cn; Path=/"),
                                &url,
                            );
                        }
                    }
                }
                self.qr.lock().await.clear();
                *self.account.write().await = Value::Null;
                self.storage.clear_account_cache()?;
                Ok(json!(true))
            }
            Command::Like { id, liked } => {
                self.require_login().await?;
                if id == 0 {
                    return Err(AppError::invalid());
                }
                self.request(
                    "/bbs/app/profile/award/link",
                    vec![],
                    Some(vec![
                        ("link_id".into(), id.to_string()),
                        ("award_type".into(), if liked { "1" } else { "0" }.into()),
                    ]),
                    None,
                )
                .await?;
                if let Some(mut post) = self
                    .storage
                    .cached(&format!("post:{id}"), 365 * 24 * 3600)?
                {
                    if model::yes(&post["liked"]) != liked {
                        let count = model::number(&post["likes"]);
                        post["likes"] = json!(if liked {
                            count + 1
                        } else {
                            count.saturating_sub(1)
                        });
                    }
                    post["liked"] = json!(liked);
                    self.storage.cache(&format!("post:{id}"), &post)?;
                }
                Ok(json!({"liked":liked}))
            }
            Command::Comment {
                id,
                text,
                reply,
                root,
                is_cy,
            } => {
                self.require_login().await?;
                if id == 0
                    || text.trim().is_empty()
                    || text.chars().count() > 5000
                    || reply.is_some() != root.is_some()
                {
                    return Err(AppError::invalid());
                }
                self.request(
                    "/bbs/app/comment/create",
                    vec![],
                    Some(vec![
                        ("link_id".into(), id.to_string()),
                        ("text".into(), text),
                        (
                            "reply_id".into(),
                            reply.map(|id| id.to_string()).unwrap_or("-1".into()),
                        ),
                        (
                            "root_id".into(),
                            root.map(|id| id.to_string()).unwrap_or("-1".into()),
                        ),
                        ("is_cy".into(), if is_cy { "1" } else { "0" }.into()),
                    ]),
                    None,
                )
                .await?;
                Ok(json!(true))
            }
        }
    }
    async fn feed(&self, mut request: FeedRequest) -> Result<Value> {
        if request.query.len() > 256
            || request.filter.included.len() > 256
            || request.filter.excluded.len() > 256
            || request.cursor.topics.len() > 256
            || request.cursor.exhausted.len() > 256
            || request.cursor.offset > 1_000_000
            || request.cursor.rotation > 1_000_000
            || request.cursor.topics.values().any(|v| *v > 1_000_000)
            || !["all", "include", "exclude"].contains(&request.filter.mode.as_str())
        {
            return Err(AppError::invalid());
        }
        if !["推荐", "关注", "最新", "热帖"].contains(&request.tab.as_str()) {
            return Err(AppError::invalid());
        }
        // The verified web feed has no server mode for following/newest/hot. Never silently fake those modes.
        if request.tab != "推荐" {
            return Err(AppError::new(
                "unsupported",
                "当前已验证的接口仅提供推荐流，请切换到推荐或选择社区",
            ));
        }
        let mut all: Vec<Post> = vec![];
        let mut has_more = true;
        let topics = if !request.query.trim().is_empty() {
            vec![]
        } else if let Some(topic) = request.topic {
            vec![topic]
        } else if request.filter.mode == "include" {
            request.filter.included.clone()
        } else {
            vec![]
        };
        let width = request.width.clamp(300, 2000).to_string();
        if !topics.is_empty() {
            let ids: Vec<_> = topics
                .iter()
                .copied()
                .collect::<HashSet<_>>()
                .into_iter()
                .filter(|id| !request.cursor.exhausted.contains(id))
                .collect();
            let mut ids = ids;
            ids.sort_unstable();
            let count = ids.len();
            let selected: Vec<_> = (0..count.min(6))
                .map(|i| ids[(request.cursor.rotation + i) % count])
                .collect();
            let responses: Vec<_> = stream::iter(selected.into_iter().map(|id| {
                let offset = *request.cursor.topics.get(&id).unwrap_or(&0);
                let width = width.clone();
                async move {
                    let result = self
                        .request(
                            "/bbs/app/topic/feeds",
                            vec![
                                ("topic_id".into(), id.to_string()),
                                ("limit".into(), "20".into()),
                                ("offset".into(), offset.to_string()),
                                ("dw".into(), width),
                            ],
                            None,
                            None,
                        )
                        .await;
                    (id, offset, result)
                }
            }))
            .buffer_unordered(4)
            .collect()
            .await;
            for (id, offset, result) in responses {
                let result = result?;
                let list = model::posts(&result);
                if result["links"]
                    .as_array()
                    .map(|a| a.is_empty())
                    .unwrap_or(true)
                {
                    request.cursor.exhausted.push(id);
                }
                request.cursor.topics.insert(id, offset + 20);
                all.extend(list.into_iter().filter(|p| p.topic_ids.contains(&id)));
            }
            request.cursor.rotation += count.min(6);
            has_more = topics
                .iter()
                .any(|id| !request.cursor.exhausted.contains(id));
        } else if request.filter.mode == "include" && request.filter.included.is_empty() {
            has_more = false;
        } else {
            for _ in 0..3 {
                let query = !request.query.trim().is_empty();
                let (path, params) = if query {
                    (
                        "/bbs/app/api/general/search/v1",
                        vec![
                            ("q".into(), request.query.clone()),
                            ("search_type".into(), "link".into()),
                            ("is_pull_down".into(), "0".into()),
                            ("offset".into(), request.cursor.offset.to_string()),
                            ("limit".into(), "30".into()),
                            ("dw".into(), width.clone()),
                        ],
                    )
                } else {
                    (
                        "/bbs/app/feeds",
                        vec![
                            ("pull".into(), "0".into()),
                            ("offset".into(), request.cursor.offset.to_string()),
                            ("dw".into(), width.clone()),
                        ],
                    )
                };
                let result = self.request(path, params, None, None).await?;
                let list = model::posts(&result);
                let raw_count = result[if query { "items" } else { "links" }]
                    .as_array()
                    .map(Vec::len)
                    .unwrap_or(0);
                request.cursor.offset += 30;
                all.extend(list.into_iter().filter(|p| {
                    request.filter.allows(p)
                        && request
                            .topic
                            .map(|id| p.topic_ids.contains(&id))
                            .unwrap_or(true)
                }));
                if raw_count == 0 {
                    has_more = false;
                    break;
                }
                if all.len() >= 10 {
                    break;
                }
            }
        }
        let mut seen = HashSet::new();
        all.retain(|p| seen.insert(p.id) && request.filter.allows(p));
        for p in &all {
            self.storage.cache(&format!("post:{}", p.id), &json!(p))?;
        }
        Ok(json!({"posts":all,"cursor":request.cursor,"hasMore":has_more}))
    }
    async fn qr_start(&self) -> Result<Value> {
        let jar = Arc::new(Jar::default());
        let client = client(jar.clone())?;
        let result = self
            .request(
                "/account/get_qrcode_url/",
                vec![("app".into(), "web".into())],
                None,
                Some(&client),
            )
            .await?;
        let url = model::text(&result["qr_url"]);
        let url = url.trim();
        let parsed = url::Url::parse(url).map_err(|_| AppError::new("qr", "二维码地址无效"))?;
        if !["http", "https", "heybox"].contains(&parsed.scheme()) {
            return Err(AppError::new("qr", "二维码格式无法识别"));
        }
        let query = parsed
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect::<Vec<_>>();
        if query.is_empty() {
            return Err(AppError::new("qr", "二维码缺少登录参数"));
        }
        let expire = model::number(&result["expire"]).clamp(30, 300);
        let svg = qrcode::QrCode::new(url.as_bytes())
            .map_err(|_| AppError::new("qr", "无法生成二维码"))?
            .render::<qrcode::render::svg::Color>()
            .min_dimensions(240, 240)
            .build();
        let session = uuid::Uuid::new_v4().to_string();
        let mut qr = self.qr.lock().await;
        qr.retain(|_, v| v.expires > now());
        if qr.len() >= 4 {
            qr.clear();
        }
        qr.insert(
            session.clone(),
            QrSession {
                query,
                expires: now() + expire,
                last_poll: 0,
                jar,
                client,
            },
        );
        Ok(json!({"session":session,"svg":svg,"expiresAt":now()+expire}))
    }
    async fn qr_poll(&self, id: &str) -> Result<Value> {
        let _guard = self.auth_lock.lock().await;
        let (query, client, jar) = {
            let mut sessions = self.qr.lock().await;
            let session = sessions
                .get_mut(id)
                .ok_or_else(|| AppError::new("qr_expired", "二维码已失效，请刷新"))?;
            if session.expires <= now() {
                sessions.remove(id);
                return Ok(json!({"state":"expired"}));
            }
            if now() < session.last_poll + 2 {
                return Ok(json!({"state":"waiting"}));
            }
            session.last_poll = now();
            (
                session.query.clone(),
                session.client.clone(),
                session.jar.clone(),
            )
        };
        let result = self
            .request("/account/qr_state/", query, None, Some(&client))
            .await?;
        let cookie = qr_cookie_header(&jar);
        let cookie_value = |name: &str| {
            cookie
                .split("; ")
                .find_map(|p| {
                    p.split_once('=')
                        .filter(|(k, _)| *k == name)
                        .map(|(_, v)| v.to_owned())
                })
                .unwrap_or_default()
        };
        let pkey = cookie_value("user_pkey");
        let uid = cookie_value("user_heybox_id");
        let uid = if uid.is_empty() {
            model::text(&result["heyboxid"])
        } else {
            uid
        };
        if !pkey.is_empty() && !uid.is_empty() {
            // A canceled QR must never install credentials after its request finishes.
            let mut sessions = self.qr.lock().await;
            if !sessions.contains_key(id) {
                return Err(AppError::new("qr_expired", "扫码已取消"));
            }
            let account = json!({"id":uid,"name":model::text(&result["nickname"]),"avatarUrl":model::image_url(&result["avatar"])});
            storage::save_credentials(
                &self.storage.directory.join("credentials.dat"),
                &json!({"cookie":cookie,"account":account}),
            )?;
            for pair in cookie.split("; ") {
                self.jar.add_cookie_str(
                    &format!("{pair}; Path=/; Secure; HttpOnly"),
                    &url::Url::parse(BASE).unwrap(),
                );
            }
            *self.account.write().await = account.clone();
            sessions.clear();
            Ok(json!({"state":"success","account":account}))
        } else {
            let error = model::text(&result["error"]);
            let state = qr_pending_state(&error);
            Ok(
                json!({"state":state,"message":if state=="error" {"扫码未完成，请刷新二维码或在官方客户端完成验证"}else{""}}),
            )
        }
    }
}
fn qr_pending_state(error: &str) -> &str {
    match error {
        "" | "wait" => "waiting",
        "ready" | "scanned" | "scan" | "confirm" => "scanned",
        "expired" | "expire" | "timeout" => "expired",
        _ => "error",
    }
}
fn qr_cookie_header(jar: &Jar) -> String {
    // Cookies scoped to /account/ are invisible when querying the site's root URL.
    jar.cookies(&url::Url::parse(&format!("{BASE}/account/qr_state/")).unwrap())
        .and_then(|v| v.to_str().ok().map(str::to_owned))
        .unwrap_or_default()
}
const STATE_KEYS: [&str; 6] = [
    "heybox.preferences",
    "heybox.community-filter",
    "heybox.bookmarks",
    "heybox.history",
    "heybox.home-communities",
    "heybox.blocked-keywords",
];
fn validate_key(key: &str) -> Result<()> {
    if STATE_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(AppError::invalid())
    }
}
fn valid_keybindings(value: &Value) -> bool {
    let Some(bindings) = value.as_object() else {
        return false;
    };
    if bindings.len() != 4
        || !["search", "settings", "back", "close"]
            .iter()
            .all(|key| bindings.contains_key(*key))
    {
        return false;
    }
    let mut seen = std::collections::HashMap::new();
    bindings.iter().all(|(action, binding)| {
        let Some(code) = binding["code"].as_str() else {
            return false;
        };
        let known =
            (code.len() == 4 && code.starts_with("Key") && code.as_bytes()[3].is_ascii_uppercase())
                || (code.len() == 6
                    && code.starts_with("Digit")
                    && code.as_bytes()[5].is_ascii_digit())
                || code
                    .strip_prefix('F')
                    .and_then(|n| n.parse::<u8>().ok())
                    .map(|n| (1..=12).contains(&n))
                    .unwrap_or(false)
                || [
                    "Comma",
                    "Period",
                    "Slash",
                    "Semicolon",
                    "Quote",
                    "BracketLeft",
                    "BracketRight",
                    "Backslash",
                    "Backquote",
                    "Minus",
                    "Equal",
                    "Space",
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "Escape",
                    "Enter",
                    "Home",
                    "End",
                    "PageUp",
                    "PageDown",
                    "Delete",
                    "Insert",
                    "Backspace",
                ]
                .contains(&code);
        let (Some(ctrl), Some(alt), Some(shift)) = (
            binding["ctrl"].as_bool(),
            binding["alt"].as_bool(),
            binding["shift"].as_bool(),
        ) else {
            return false;
        };
        known
            && match seen.insert((code.to_owned(), ctrl, alt, shift), action.as_str()) {
                None => true,
                Some(other) => matches!(
                    (other, action.as_str()),
                    ("back", "close") | ("close", "back")
                ),
            }
    })
}
fn validate_state(key: &str, value: &Value) -> Result<()> {
    validate_key(key)?;
    if value.to_string().len() > 65536 {
        return Err(AppError::invalid());
    }
    let id_list = |value: &Value| {
        value
            .as_array()
            .map(|a| a.len() <= 500 && a.iter().all(|v| v.as_u64().map(|n| n > 0).unwrap_or(false)))
            .unwrap_or(false)
    };
    let valid = match key {
        "heybox.blocked-keywords" => {
            let mut seen = std::collections::HashSet::new();
            value
                .as_array()
                .map(|items| {
                    items.len() <= 128
                        && items.iter().all(|v| {
                            v.as_str()
                                .map(|word| {
                                    !word.is_empty()
                                        && word.trim() == word
                                        && word.chars().count() <= 100
                                        && !word.contains(['\r', '\n'])
                                        && seen.insert(word.to_lowercase())
                                })
                                .unwrap_or(false)
                        })
                })
                .unwrap_or(false)
        }
        "heybox.home-communities" => {
            if value.is_null() {
                true
            } else {
                serde_json::from_value::<Vec<model::Community>>(value.clone())
                    .ok()
                    .map(|items| {
                        let mut ids = std::collections::HashSet::new();
                        items.len() <= 7
                            && items.iter().all(|c| {
                                c.id > 0
                                    && ids.insert(c.id)
                                    && !c.name.trim().is_empty()
                                    && c.name.len() <= 256
                                    && c.short.len() <= 32
                                    && c.color.len() <= 32
                                    && c.members.len() <= 128
                                    && (c.icon.is_empty()
                                        || (!model::image_url(&json!(c.icon)).is_empty()
                                            && c.icon.len() <= 4096))
                            })
                    })
                    .unwrap_or(false)
            }
        }
        "heybox.preferences" => {
            value["zoom"]
                .as_u64()
                .map(|z| (50..=300).contains(&z))
                .unwrap_or(false)
                && ["light", "dark", "system"].contains(&value["theme"].as_str().unwrap_or(""))
                && ["tray", "close"].contains(&value["exit"].as_str().unwrap_or(""))
                && value["shortcuts"].is_boolean()
                && value["animations"].is_boolean()
                && value
                    .get("showSidebar")
                    .map(Value::is_boolean)
                    .unwrap_or(true)
                && value
                    .get("keybindings")
                    .map(valid_keybindings)
                    .unwrap_or(true)
                && value
                    .get("windowHeight")
                    .map(|v| {
                        v.as_u64()
                            .map(|h| (480..=1200).contains(&h))
                            .unwrap_or(false)
                    })
                    .unwrap_or(true)
                && value
                    .get("windowWidth")
                    .map(|v| {
                        v.as_u64()
                            .map(|w| (600..=1600).contains(&w))
                            .unwrap_or(false)
                    })
                    .unwrap_or(true)
        }
        "heybox.community-filter" => {
            ["all", "include", "exclude"].contains(&value["mode"].as_str().unwrap_or(""))
                && id_list(&value["included"])
                && id_list(&value["excluded"])
                && value["unknown"].is_boolean()
        }
        _ => id_list(value),
    };
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid())
    }
}
fn public_account(u: &Value, id: &str) -> Value {
    let bio = model::text(&u["signature"]);
    json!({"id":id,"name":model::text(&u["username"]),"avatarUrl":model::image_url(&u["avatar"]),"level":model::number(&u["level_info"]["level"]),"bio":if bio.is_empty() { model::text(&u["description"]) } else { bio }})
}
fn merge_account_profile(current: &Value, profile: &Value) -> Value {
    let mut account = current.clone();
    for key in ["name", "avatarUrl", "bio"] {
        if !model::text(&profile[key]).is_empty() {
            account[key] = profile[key].clone();
        }
    }
    if model::number(&profile["level"]) > 0 {
        account["level"] = profile["level"].clone();
    }
    account
}
fn check_status(value: &Value) -> Result<()> {
    match value["status"].as_str().unwrap_or("") {
        "ok" => Ok(()),
        "login" => Err(AppError::new("login", "登录已失效，请重新扫码登录")),
        "show_captcha" => Err(AppError {
            code: "show_captcha".into(),
            message: "小黑盒要求安全验证，请前往官方页面完成验证；也可以先扫码登录后重试".into(),
            official_url: Some(OFFICIAL.into()),
        }),
        "lack_token" => Err(AppError::new(
            "lack_token",
            "小黑盒要求重新验证登录，请重新扫码或前往官方社区",
        )),
        _ => Err(AppError::new(
            "upstream",
            "小黑盒暂未接受此次请求，请稍后重试",
        )),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn blocked_keywords_validate_text_limits_and_unique_literals() {
        let key = "heybox.blocked-keywords";
        assert!(validate_state(key, &json!([])).is_ok());
        assert!(validate_state(
            key,
            &json!(["剧透", "Spoiler", ".*", "两个 词", "😀".repeat(100)])
        )
        .is_ok());
        let maximum: Vec<String> = (0..128).map(|i| format!("关键词{i}")).collect();
        assert!(validate_state(key, &json!(maximum)).is_ok());
        for invalid in [
            json!([""]),
            json!(["  "]),
            json!([" 前导"]),
            json!(["尾随 "]),
            json!(["两\n行"]),
            json!(["回\r车"]),
            json!(["a", "A"]),
            json!(["重复", "重复"]),
            json!(["😀".repeat(101)]),
            json!((0..129).map(|i| i.to_string()).collect::<Vec<_>>()),
            json!([1]),
            Value::Null,
            json!({"word":"x"}),
        ] {
            assert!(validate_state(key, &invalid).is_err(), "{invalid}");
        }
        assert!(validate_key(key).is_ok());
    }
    #[test]
    fn window_width_preferences_accept_range_and_legacy_default() {
        let mut preferences =
            json!({"theme":"light","zoom":100,"exit":"close","shortcuts":true,"animations":true});
        assert!(validate_state("heybox.preferences", &preferences).is_ok());
        for width in [600, 720, 960, 1600] {
            preferences["windowWidth"] = json!(width);
            assert!(validate_state("heybox.preferences", &preferences).is_ok());
        }
        for width in [
            json!(599),
            json!(1601),
            json!(720.5),
            json!("720"),
            Value::Null,
        ] {
            preferences["windowWidth"] = width;
            assert!(validate_state("heybox.preferences", &preferences).is_err());
        }
    }
    #[test]
    fn window_height_preferences_accept_range_and_legacy_default() {
        let mut preferences =
            json!({"theme":"light","zoom":100,"exit":"close","shortcuts":true,"animations":true});
        assert!(validate_state("heybox.preferences", &preferences).is_ok());
        for height in [480, 760, 1200] {
            preferences["windowHeight"] = json!(height);
            assert!(validate_state("heybox.preferences", &preferences).is_ok());
        }
        for height in [
            json!(479),
            json!(1201),
            json!(760.5),
            json!("760"),
            Value::Null,
        ] {
            preferences["windowHeight"] = height;
            assert!(validate_state("heybox.preferences", &preferences).is_err());
        }
    }
    #[test]
    fn home_communities_preserve_order_and_validate_limits() {
        let item = json!({"id":10,"name":"社区","short":"社","color":"#5c6c85","members":"社区","icon":"https://example.com/icon.png"});
        assert!(validate_state("heybox.home-communities", &Value::Null).is_ok());
        assert!(validate_state("heybox.home-communities", &json!([])).is_ok());
        assert!(validate_state("heybox.home-communities", &json!([item])).is_ok());
        assert!(validate_state("heybox.home-communities", &json!([item, item])).is_err());
        let items = (1..=8)
            .map(|id| {
                let mut c = item.clone();
                c["id"] = json!(id);
                c
            })
            .collect::<Vec<_>>();
        assert!(validate_state("heybox.home-communities", &json!(items)).is_err());
        let mut invalid = item.clone();
        invalid["icon"] = json!("javascript:invalid()");
        assert!(validate_state("heybox.home-communities", &json!([invalid])).is_err());
    }
    #[test]
    fn custom_keybindings_are_saved_with_legacy_preferences_supported() {
        let mut preferences = serde_json::json!({"theme":"light","zoom":100,"exit":"close","shortcuts":true,"animations":true});
        assert!(super::validate_state("heybox.preferences", &preferences).is_ok());
        preferences["keybindings"] = serde_json::json!({
            "search":{"code":"KeyG","ctrl":true,"alt":false,"shift":false},
            "settings":{"code":"Comma","ctrl":true,"alt":false,"shift":false},
            "back":{"code":"ArrowLeft","ctrl":false,"alt":true,"shift":false},
            "close":{"code":"Escape","ctrl":false,"alt":false,"shift":false}
        });
        assert!(super::validate_state("heybox.preferences", &preferences).is_ok());
        preferences["keybindings"]["back"] = preferences["keybindings"]["close"].clone();
        assert!(super::validate_state("heybox.preferences", &preferences).is_ok());
        preferences["keybindings"]["back"] =
            serde_json::json!({"code":"KeyB","ctrl":true,"alt":false,"shift":false});
        preferences["keybindings"]["close"] = preferences["keybindings"]["back"].clone();
        assert!(super::validate_state("heybox.preferences", &preferences).is_ok());
        preferences["keybindings"]["back"] = preferences["keybindings"]["search"].clone();
        assert!(super::validate_state("heybox.preferences", &preferences).is_err());
        preferences["keybindings"]["back"]["code"] = serde_json::json!("Unknown");
        assert!(super::validate_state("heybox.preferences", &preferences).is_err());
    }
    use super::*;
    #[test]
    fn own_profile_fills_avatar_without_overwriting_login_identity() {
        let current = json!({"id":"12345","name":"扫码昵称","avatarUrl":""});
        let profile = public_account(
            &json!({"username":"资料昵称","avatar":"//example.com/avatar.png","level_info":{"level":13}}),
            "12345",
        );
        let account = merge_account_profile(&current, &profile);
        assert_eq!(account["avatarUrl"], "https://example.com/avatar.png");
        assert_eq!(account["name"], "资料昵称");
        assert_eq!(account["id"], current["id"]);
        assert_eq!(account["level"], 13);
        assert!(account.get("cookie").is_none());
    }
    #[test]
    fn incomplete_profile_preserves_saved_account_fields() {
        let current = json!({"id":"12345","name":"扫码昵称","avatarUrl":"https://example.com/avatar.png","level":13});
        let profile = public_account(&json!({"avatar":"http://example.com/unsafe.png"}), "12345");
        assert_eq!(merge_account_profile(&current, &profile), current);
    }
    #[test]
    fn scanned_qr_keeps_polling_until_phone_confirms() {
        assert_eq!(qr_pending_state("wait"), "waiting");
        assert_eq!(qr_pending_state("ready"), "scanned");
        assert_eq!(qr_pending_state("expired"), "expired");
        assert_eq!(qr_pending_state("unknown"), "error");
    }
    #[test]
    fn login_cookies_are_read_from_the_poll_endpoint_path() {
        let jar = Jar::default();
        let poll_url = url::Url::parse(&format!("{BASE}/account/qr_state/")).unwrap();
        // Without an explicit Path, a response cookie belongs to /account/qr_state.
        jar.add_cookie_str(
            "user_pkey=synthetic-test-key; Domain=.xiaoheihe.cn; Secure; HttpOnly",
            &poll_url,
        );
        jar.add_cookie_str(
            "user_heybox_id=12345; Path=/account/; Secure; HttpOnly",
            &poll_url,
        );
        let cookie = qr_cookie_header(&jar);
        assert!(cookie.contains("user_pkey=synthetic-test-key"));
        assert!(cookie.contains("user_heybox_id=12345"));
    }
    #[test]
    fn business_errors_are_not_http_success() {
        assert_eq!(
            check_status(&json!({"status":"show_captcha"}))
                .unwrap_err()
                .code,
            "show_captcha"
        );
        assert!(check_status(&json!({"status":"ok"})).is_ok());
        assert!(serde_json::from_value::<Command>(
            json!({"type":"proxy","payload":{"url":"https://example.com"}})
        )
        .is_err());
        assert!(validate_key("cookie").is_err());
        assert!(validate_state("heybox.preferences", &json!({"zoom":10000})).is_err());
        let mut preferences =
            json!({"theme":"light","zoom":100,"exit":"close","shortcuts":true,"animations":true});
        assert!(validate_state("heybox.preferences", &preferences).is_ok());
        for show in [true, false] {
            preferences["showSidebar"] = json!(show);
            assert!(validate_state("heybox.preferences", &preferences).is_ok());
        }
        preferences["showSidebar"] = json!("false");
        assert!(validate_state("heybox.preferences", &preferences).is_err());
    }
}
