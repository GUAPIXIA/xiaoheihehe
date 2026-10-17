use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub fn text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}
pub fn number(v: &Value) -> u64 {
    v.as_u64().or_else(|| v.as_str()?.parse().ok()).unwrap_or(0)
}
pub fn yes(v: &Value) -> bool {
    v.as_bool().unwrap_or_else(|| number(v) != 0)
}
pub fn image_url(v: &Value) -> String {
    let s = text(v);
    if s.starts_with("https://") {
        s
    } else if s.starts_with("//") {
        format!("https:{s}")
    } else {
        String::new()
    }
}
pub fn emojis(result: &Value) -> Value {
    let mut catalog = vec![];
    let mut seen = std::collections::HashSet::new();
    for group in result["emoji_groups"].as_array().into_iter().flatten() {
        if ![1, 3].contains(&number(&group["type"])) {
            continue;
        }
        let prefix = text(&group["group_code"]);
        if prefix.is_empty()
            || !prefix
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            continue;
        }
        for emoji in group["emojis"].as_array().into_iter().flatten() {
            let name = text(&emoji["code"]);
            let url = image_url(&emoji["img"]);
            if name.is_empty() || name.contains(['[', ']', '\n', '\r']) || url.is_empty() {
                continue;
            }
            let token = format!("[{prefix}_{name}]");
            if seen.insert(token.clone()) {
                catalog.push(serde_json::json!({"token":token,"name":name,"url":url,"group":prefix,"groupName":text(&group["expression_pack_name"])}));
            }
        }
    }
    serde_json::json!({"version":text(&result["emoji_version"]),"emojis":catalog})
}
fn first(v: &Value, keys: &[&str]) -> String {
    keys.iter()
        .map(|k| text(&v[*k]))
        .find(|s| !s.is_empty())
        .unwrap_or_default()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Community {
    pub id: u64,
    pub name: String,
    pub short: String,
    pub color: String,
    pub members: String,
    pub icon: String,
}
pub fn communities(v: &Value) -> Vec<Community> {
    fn walk(v: &Value, out: &mut Vec<Community>, icon_ranks: &mut Vec<u8>) {
        let id = number(&v["topic_id"]);
        let name = text(&v["name"]).trim().to_owned();
        if id != 0 && !name.is_empty() {
            // Web community lists use small_pic_url; pic_url may be a game cover.
            let small_icon = image_url(&v["small_pic_url"]);
            let icon = if small_icon.is_empty() {
                image_url(&v["pic_url"])
            } else {
                small_icon.clone()
            };
            let rank = if !small_icon.is_empty() {
                2
            } else if !icon.is_empty() {
                1
            } else {
                0
            };
            if let Some(index) = out.iter().position(|c| c.id == id) {
                // A later occurrence can supply the missing or more specific icon.
                if rank > icon_ranks[index] {
                    out[index].icon = icon;
                    icon_ranks[index] = rank;
                }
            } else {
                out.push(Community {
                    id,
                    short: name.chars().next().unwrap_or('盒').to_string(),
                    name,
                    color: "#5c6c85".into(),
                    members: "社区".into(),
                    icon,
                });
                icon_ranks.push(rank);
            }
        }
        match v {
            Value::Array(a) => {
                for child in a {
                    walk(child, out, icon_ranks);
                }
            }
            Value::Object(o) => {
                for child in o.values() {
                    if child.is_array() || child.is_object() {
                        walk(child, out, icon_ranks);
                    }
                }
            }
            _ => (),
        }
    }
    let mut result = Vec::new();
    walk(v, &mut result, &mut Vec::new());
    result
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Post {
    pub id: u64,
    pub user_id: String,
    pub author: String,
    pub avatar: String,
    pub avatar_url: String,
    pub color: String,
    pub time: String,
    pub title: String,
    pub excerpt: String,
    pub body: Vec<String>,
    pub topic_ids: Vec<u64>,
    pub topics: Vec<Community>,
    pub likes: u64,
    pub comments: u64,
    pub images: Vec<String>,
    pub level: u64,
    pub medal_url: String,
    pub medal_name: String,
    pub liked: bool,
    pub followed: bool,
    pub created_at: u64,
    pub kind: String,
    pub video_url: String,
    pub is_cy: bool,
}
pub fn plain_text(input: &str) -> String {
    let document = Html::parse_fragment(input);
    let selector = Selector::parse("script,style,iframe,object").unwrap();
    let blocked: std::collections::HashSet<_> = document
        .select(&selector)
        .flat_map(|e| e.descendants().map(|n| n.id()))
        .collect();
    document
        .tree
        .nodes()
        .filter(|n| !blocked.contains(&n.id()))
        .filter_map(|n| n.value().as_text())
        .map(|t| t.text.as_ref())
        .collect::<Vec<_>>()
        .join("")
}
fn post_body(input: &str) -> (Vec<String>, Vec<String>) {
    let parsed = serde_json::from_str::<Value>(input).ok();
    if let Some(blocks) = parsed.as_ref().and_then(Value::as_array) {
        let mut paragraphs = vec![];
        let mut images = vec![];
        for block in blocks {
            match block["type"].as_str().unwrap_or("") {
                "text" => {
                    let text = plain_text(&text(&block["text"]));
                    if !text.trim().is_empty() {
                        paragraphs.push(text);
                    }
                }
                "img" | "image" => {
                    let image = image_url(&Value::String(first(block, &["url", "text"])));
                    if !image.is_empty() {
                        images.push(image);
                    }
                }
                _ => {}
            }
        }
        return (paragraphs, images);
    }
    if input.is_empty() {
        return (vec![], vec![]);
    }
    let document = Html::parse_fragment(input);
    let images = document
        .select(&Selector::parse("img[src]").unwrap())
        .filter_map(|node| node.value().attr("src"))
        .map(|src| image_url(&Value::String(src.into())))
        .filter(|url| !url.is_empty())
        .collect();
    let text = plain_text(input);
    (
        if text.trim().is_empty() {
            vec![]
        } else {
            vec![text]
        },
        images,
    )
}
pub fn post(v: &Value) -> Option<Post> {
    let id = number(&v["linkid"]).max(number(&v["link_id"]));
    if id == 0 || number(&v["content_type"]) == 18 {
        return None;
    }
    let user = &v["user"];
    let author = first(user, &["username", "nickname", "name"]);
    let author = if author.is_empty() {
        format!("盒友 {}", first(v, &["userid", "user_id"]))
    } else {
        author
    };
    let topics = communities(&v["topics"]);
    let mut images: Vec<String> = v["imgs"]
        .as_array()
        .or_else(|| v["thumbs"].as_array())
        .map(|a| {
            a.iter()
                .map(|v| {
                    if v.is_string() {
                        image_url(v)
                    } else {
                        image_url(&v["url"])
                    }
                })
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let medal = user["medal"]
        .as_array()
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or(Value::Null);
    let excerpt = plain_text(&first(v, &["description", "summary", "text"]));
    let raw_body = first(v, &["content", "text", "description"]);
    let (body, body_images) = post_body(&raw_body);
    images.extend(body_images);
    let mut seen = std::collections::HashSet::new();
    images.retain(|url| seen.insert(url.clone()));
    let time = first(v, &["formated_time", "formatted_time", "time"]);
    Some(Post {
        id,
        user_id: {
            let id = first(v, &["userid", "user_id"]);
            if id.is_empty() {
                first(user, &["userid", "user_id"])
            } else {
                id
            }
        },
        avatar: author.chars().next().unwrap_or('盒').to_string(),
        author,
        avatar_url: image_url(&Value::String(first(user, &["avatar", "avartar"]))),
        color: "#8796aa".into(),
        time: if time.is_empty() { "".into() } else { time },
        title: plain_text(&text(&v["title"])),
        excerpt,
        body,
        topic_ids: topics.iter().map(|t| t.id).collect(),
        topics,
        likes: number(&v["link_award_num"]),
        comments: number(&v["comment_num"]),
        images,
        level: number(&user["level_info"]["level"]),
        medal_url: image_url(&medal["img_url"]),
        medal_name: text(&medal["name"]),
        liked: yes(&v["is_award_link"]),
        followed: yes(&user["is_follow"]),
        created_at: number(&v["create_at"]).max(number(&v["modify_at"])),
        kind: match number(&v["link_tag"]) {
            1 => "视频",
            11 => "文章",
            27 => "图文",
            _ => "讨论",
        }
        .into(),
        video_url: image_url(&v["video_url"]),
        is_cy: yes(&v["is_cy"]),
    })
}
pub fn posts(result: &Value) -> Vec<Post> {
    let list = result["links"]
        .as_array()
        .or_else(|| result["items"].as_array())
        .or_else(|| result["moments"].as_array());
    list.map(|list| {
        list.iter()
            .filter_map(|v| post(if v["info"].is_object() { &v["info"] } else { v }))
            .collect()
    })
    .unwrap_or_default()
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Filter {
    pub mode: String,
    pub included: Vec<u64>,
    pub excluded: Vec<u64>,
    pub unknown: bool,
}
impl Filter {
    pub fn allows(&self, p: &Post) -> bool {
        if p.topic_ids.is_empty() {
            return self.unknown && self.mode != "include";
        }
        if p.topic_ids.iter().any(|id| self.excluded.contains(id)) && self.mode == "exclude" {
            return false;
        }
        self.mode != "include" || p.topic_ids.iter().any(|id| self.included.contains(id))
    }
}
// Upstream comment images arrive in several shapes: an object array (url/thumb/src),
// a string array, or one `;`-separated string produced by the web editor.
fn collect_image_candidates(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_image_candidates(item, out);
            }
        }
        Value::Object(map) => {
            let picked = ["url", "thumb", "src", "img", "pic"]
                .iter()
                .find_map(|key| map.get(*key).map(text).filter(|s| !s.is_empty()));
            if let Some(found) = picked {
                out.push(found);
            }
        }
        Value::String(s) => out.extend(
            s.split(';')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(str::to_owned),
        ),
        _ => (),
    }
}
fn comment_images(v: &Value) -> Vec<String> {
    let mut candidates = vec![];
    collect_image_candidates(&v["imgs"], &mut candidates);
    let mut images: Vec<String> = candidates
        .iter()
        .map(|s| image_url(&Value::String(s.clone())))
        .filter(|url| !url.is_empty())
        .collect();
    if images.is_empty() {
        // Some payloads inline images in the comment HTML instead of `imgs`.
        let html = first(v, &["text", "content"]);
        if !html.is_empty() {
            let document = Html::parse_fragment(&html);
            for node in document.select(&Selector::parse("img[src]").unwrap()) {
                if let Some(src) = node.value().attr("src") {
                    let url = image_url(&Value::String(src.into()));
                    if !url.is_empty() {
                        images.push(url);
                    }
                }
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    images.retain(|url| seen.insert(url.clone()));
    images
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: u64,
    #[serde(default)]
    pub user_id: String,
    pub author: String,
    pub avatar: String,
    pub avatar_url: String,
    pub text: String,
    #[serde(default)]
    pub images: Vec<String>,
    pub likes: u64,
    pub time: String,
    pub root_id: u64,
    #[serde(default)]
    pub level: u64,
    #[serde(default)]
    pub medal_url: String,
    #[serde(default)]
    pub medal_name: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub is_author: bool,
    #[serde(default)]
    pub created_at: u64,
    #[serde(default)]
    pub reply_to: String,
    #[serde(default)]
    pub reply_count: u64,
    #[serde(default)]
    pub has_more_replies: bool,
    #[serde(default)]
    pub replies: Vec<Comment>,
}
fn comment(v: &Value, root: Option<u64>) -> Option<Comment> {
    let id = number(&v["commentid"]).max(number(&v["comment_id"]));
    if id == 0 {
        return None;
    }
    let user = &v["user"];
    let name = first(user, &["username", "nickname"]);
    let medal = user["medal"]
        .as_array()
        .and_then(|a| a.first())
        .unwrap_or(&Value::Null);
    Some(Comment {
        id,
        user_id: {
            let id = first(v, &["userid", "user_id"]);
            if id.is_empty() {
                first(user, &["userid", "user_id"])
            } else {
                id
            }
        },
        avatar: name.chars().next().unwrap_or('盒').to_string(),
        author: name,
        avatar_url: image_url(&Value::String(first(user, &["avatar", "avartar"]))),
        text: plain_text(&first(v, &["text", "content"])),
        images: comment_images(v),
        likes: number(&v["up"]).max(number(&v["support_num"])),
        time: first(v, &["formated_time", "formatted_time"]),
        root_id: root.unwrap_or_else(|| match number(&v["root_id"]) {
            0 => id,
            root => root,
        }),
        level: number(&user["level_info"]["level"]),
        medal_url: image_url(&medal["img_url"]),
        medal_name: text(&medal["name"]),
        // is_top marks hot comments; top_comment marks an author's pinned comment.
        pinned: yes(&v["top_comment"]),
        is_author: yes(&v["is_link_owner"]),
        created_at: number(&v["create_at"]),
        reply_to: if v["replyuser"].is_object() {
            first(&v["replyuser"], &["username", "nickname"])
        } else {
            text(&v["replyuser"])
        },
        reply_count: number(&v["child_num"]),
        has_more_replies: yes(&v["has_more"]),
        replies: vec![],
    })
}
pub fn comments(result: &Value) -> Vec<Comment> {
    let list = result["comments"]
        .as_array()
        .or_else(|| result["floors"].as_array())
        .or_else(|| result["comment_list"].as_array());
    list.map(|a| {
        a.iter()
            .filter_map(|floor| {
                let v = if let Some(comments) = floor["comment"].as_array() {
                    // The first item is the floor's root; subsequent items preview replies.
                    comments.first()?
                } else if floor["comment"].is_object() {
                    &floor["comment"]
                } else {
                    floor
                };
                let mut normalized = comment(v, None)?;
                if let Some(items) = floor["comment"].as_array() {
                    normalized.replies = items
                        .iter()
                        .skip(1)
                        .filter_map(|v| comment(v, Some(normalized.id)))
                        .collect();
                }
                Some(normalized)
            })
            .collect()
    })
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn community_icons_prefer_web_logos_and_complete_duplicate_nodes() {
        let raw = serde_json::json!([
            {"topic_id":1,"name":"游戏","pic_url":"https://example.com/cover.jpg"},
            {"topic_id":2,"name":"缺图"},
            {"topic_id":3,"title":"不是社区节点","pic_url":"https://example.com/menu.png"},
            {"topic_id":1,"name":"游戏","small_pic_url":"//example.com/logo.png"},
            {"topic_id":2,"name":"缺图","pic_url":"https://example.com/second.png"},
            {"topic_id":1,"name":"游戏","pic_url":"https://example.com/other-cover.jpg"},
            {"topic_id":4,"name":"回退","small_pic_url":"javascript:invalid()","pic_url":"https://example.com/fallback.png"}
        ]);
        let list = communities(&raw);
        assert_eq!(list.iter().map(|c| c.id).collect::<Vec<_>>(), vec![1, 2, 4]);
        assert_eq!(list[0].icon, "https://example.com/logo.png");
        assert_eq!(list[1].icon, "https://example.com/second.png");
        assert_eq!(list[2].icon, "https://example.com/fallback.png");
    }
    #[test]
    fn emoji_tokens_follow_group_codes_and_ignore_stickers_and_active_urls() {
        let raw = serde_json::json!({"emoji_version":"v1","emoji_groups":[
            {"type":1,"group_code":"cube","emojis":[{"code":"哭泣","img":"https://example.com/cry.png"},{"code":"哭泣","img":"https://example.com/duplicate.png"},{"code":"错误","img":"javascript:alert(1)"}]},
            {"type":3,"group_code":"heygirl","emojis":[{"code":"无语","img":"//example.com/silent.png"}]},
            {"type":2,"group_code":"sticker","emojis":[{"code":"比心","img":"https://example.com/sticker.png"}]}
        ]});
        let result = emojis(&raw);
        assert_eq!(result["emojis"].as_array().unwrap().len(), 2);
        assert_eq!(result["emojis"][0]["token"], "[cube_哭泣]");
        assert_eq!(result["emojis"][1]["url"], "https://example.com/silent.png");
    }
    #[test]
    fn author_identity_survives_nested_user_and_moment_responses() {
        let raw = serde_json::json!({"moments":[{"linkid":42,"user":{"userid":12345,"username":"盒友"}}]});
        let normalized = posts(&raw);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].user_id, "12345");
        let normalized = comments(
            &serde_json::json!({"comments":[{"commentid":1,"user":{"userid":12345,"username":"盒友"}}]}),
        );
        assert_eq!(normalized[0].user_id, "12345");
    }
    #[test]
    fn comment_metadata_and_reply_previews_are_preserved() {
        let raw = serde_json::json!({"comments":[{"comment":[
            {"commentid":100,"top_comment":1,"is_top":1,"child_num":4,"has_more":1,"is_link_owner":1,"user":{"username":"楼主","level_info":{"level":21}}},
            {"commentid":101,"replyid":100,"replyuser":{"username":"楼主"},"user":{"username":"回复者","level_info":{"level":11}}}
        ]},{"comment":[{"commentid":200,"is_top":1,"user":{"level_info":{"level":8}}}]}]});
        let list = serde_json::to_value(comments(&raw)).unwrap();
        assert_eq!(list[0]["pinned"], true);
        assert_eq!(list[1]["pinned"], false);
        assert_eq!(list[0]["level"], 21);
        assert_eq!(list[0]["isAuthor"], true);
        assert_eq!(list[0]["replyCount"], 4);
        assert_eq!(list[0]["hasMoreReplies"], true);
        assert_eq!(list[0]["replies"][0]["id"], 101);
        assert_eq!(list[0]["replies"][0]["rootId"], 100);
        assert_eq!(list[0]["replies"][0]["replyTo"], "楼主");
    }
    #[test]
    fn detail_decodes_text_blocks_and_embedded_images() {
        let blocks = serde_json::json!([
            {"type":"text","text":"正文内容"},
            {"type":"img","url":"https://example.com/first.png","text":"图片说明"},
            {"type":"img","url":"//example.com/second.png"}
        ]);
        let p = post(&serde_json::json!({"linkid":42,"text":blocks.to_string()})).unwrap();
        assert_eq!(p.body, vec!["正文内容"]);
        assert_eq!(
            p.images,
            vec![
                "https://example.com/first.png",
                "https://example.com/second.png"
            ]
        );
    }
    #[test]
    fn detail_floor_arrays_preserve_root_comments() {
        let result = serde_json::json!({"comments":[
            {"comment":[{"commentid":100,"text":"主评论","user":{"username":"盒友"}}, {"commentid":101,"root_id":100,"text":"预览回复"}]},
            {"comment":[{"commentid":200,"text":"第二楼"}]},
            {"comment":[]}
        ]});
        let list = comments(&result);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, 100);
        assert_eq!(list[0].root_id, 100);
        assert_eq!(list[0].text, "主评论");
        assert_eq!(list[1].id, 200);
    }
    #[test]
    fn body_images_are_deduplicated_and_active_urls_are_rejected() {
        let p = post(&serde_json::json!({"linkid":42,"imgs":["https://example.com/photo.png"],"content":"<p>正文</p><img src='https://example.com/photo.png'><img src='javascript:alert(1)'><script>unsafe()</script>"})).unwrap();
        assert_eq!(p.body, vec!["正文"]);
        assert_eq!(p.images, vec!["https://example.com/photo.png"]);
        let blocks = serde_json::json!([{"type":"img","url":"javascript:alert(1)"},{"type":"text","text":"<script>unsafe()</script>"}]);
        let p = post(&serde_json::json!({"linkid":43,"text":blocks.to_string()})).unwrap();
        assert!(p.body.is_empty());
        assert!(p.images.is_empty());
    }
    #[test]
    fn normalization_and_membership() {
        let v = serde_json::json!({"linkid":12,"link_tag":11,"topics":[{"topic_id":43,"name":"CS2"},{"topic_id":7214,"name":"盒友杂谈"}],"user":{"username":"a","level_info":{"level":18},"medal":[{"img_url":"https://example.com/a.png"}]},"imgs":["javascript:evil()","https://example.com/b.png"]});
        let p = post(&v).unwrap();
        assert_eq!(p.topic_ids, vec![43, 7214]);
        assert_eq!(p.level, 18);
        assert_eq!(p.images.len(), 1);
        assert!(!Filter {
            mode: "exclude".into(),
            excluded: vec![7214],
            unknown: true,
            ..Default::default()
        }
        .allows(&p));
        assert!(Filter {
            mode: "include".into(),
            included: vec![43],
            ..Default::default()
        }
        .allows(&p));
    }
    #[test]
    fn drop_ads_and_active_markup() {
        assert!(post(&serde_json::json!({"content_type":18,"linkid":1})).is_none());
        assert_eq!(
            plain_text("<p>hello</p><script>alert(1)</script><style>x</style><b>world</b>"),
            "helloworld"
        );
    }
    #[test]
    fn unknown_is_not_an_inclusion_match() {
        let p = post(&serde_json::json!({"linkid":1})).unwrap();
        assert!(!Filter {
            mode: "include".into(),
            unknown: true,
            ..Default::default()
        }
        .allows(&p));
        assert!(Filter {
            mode: "exclude".into(),
            unknown: true,
            ..Default::default()
        }
        .allows(&p));
    }
    #[test]
    fn replies_preserve_root_identity() {
        let result = serde_json::json!({"comments":[{"commentid":200,"root_id":100,"text":"reply","user":{"username":"user"}}]});
        let normalized = comments(&result);
        assert_eq!(normalized[0].root_id, 100);
    }
    #[test]
    fn comment_images_decode_object_string_and_separator_shapes() {
        // First entry mirrors the real payload of post 194082427 commentid 977357367.
        let list = serde_json::to_value(comments(&serde_json::json!({"comments":[
            {"commentid":977357367,"user":{"username":"猫饼虾"},"text":"我这哥布林工匠还有四颗魔丸守护[cube_惊讶]",
             "imgs":[{"height":1080,"mimetype":"image/jpeg","width":1920,"thumb":"https://example.com/both.jpeg","url":"https://example.com/both.jpeg"}]},
            {"commentid":2,"user":{"username":"b"},"text":"只有缩略图","imgs":[{"height":1,"mimetype":"image/webp","thumb":"//example.com/thumb.webp"}]},
            {"commentid":3,"user":{"username":"c"},"text":"字符串数组","imgs":["https://example.com/three.png"]},
            {"commentid":4,"user":{"username":"d"},"text":"分号字符串","imgs":"//example.com/four.png; https://example.com/five.png ;"}
        ]}))).unwrap();
        assert_eq!(
            list[0]["images"],
            serde_json::json!(["https://example.com/both.jpeg"])
        );
        assert_eq!(
            list[0]["text"],
            "我这哥布林工匠还有四颗魔丸守护[cube_惊讶]"
        );
        assert_eq!(
            list[1]["images"],
            serde_json::json!(["https://example.com/thumb.webp"])
        );
        assert_eq!(
            list[2]["images"],
            serde_json::json!(["https://example.com/three.png"])
        );
        assert_eq!(
            list[3]["images"],
            serde_json::json!([
                "https://example.com/four.png",
                "https://example.com/five.png"
            ])
        );
    }
    #[test]
    fn comment_images_drop_insecure_and_duplicate_urls() {
        let list = serde_json::to_value(comments(&serde_json::json!({"comments":[{
            "commentid":10,"user":{"username":"a"},"text":"去重",
            "imgs":[{"url":"https://example.com/a.png"},{"thumb":"https://example.com/a.png"},{"src":"http://example.com/b.png"},{"url":"javascript:alert(1)"}]
        }]})))
        .unwrap();
        assert_eq!(list[0]["images"], serde_json::json!(["https://example.com/a.png"]));
    }
    #[test]
    fn comment_images_fall_back_to_inline_html_without_leaking_markup() {
        let list = serde_json::to_value(comments(&serde_json::json!({"comments":[
            {"commentid":20,"user":{"username":"a"},"text":"<p>看这个</p><img src='//example.com/inline.png'><script>unsafe()</script>"},
            {"commentid":21,"user":{"username":"b"},"text":"<img src='https://example.com/kept.png'>","imgs":[{"url":"http://example.com/rejected.png"}]}
        ]}))).unwrap();
        assert_eq!(
            list[0]["images"],
            serde_json::json!(["https://example.com/inline.png"])
        );
        assert_eq!(list[0]["text"], "看这个");
        assert_eq!(
            list[1]["images"],
            serde_json::json!(["https://example.com/kept.png"])
        );
    }
    #[test]
    fn comment_images_absent_key_yields_empty_list() {
        let list = serde_json::to_value(comments(&serde_json::json!({"comments":[
            {"commentid":30,"user":{"username":"a"},"text":"没有图"},
            {"commentid":31,"user":{"username":"b"},"text":"子评论","replyuser":{"username":"x"}}
        ]}))).unwrap();
        assert_eq!(list[0]["images"], serde_json::json!([]));
        assert_eq!(list[1]["images"], serde_json::json!([]));
        // Older cached JSON without the field must still deserialize.
        let legacy: Comment = serde_json::from_value(serde_json::json!({"id":1,"author":"a","avatar":"a","avatarUrl":"","text":"t","likes":0,"time":"","rootId":1})).unwrap();
        assert!(legacy.images.is_empty());
    }
}
