# 交付物 3 — xhh-core 覆盖情况与复用评估

调研对象：`https://github.com/Sakura520222/xhh-workshop`（本次 `--depth 1` 只读克隆到 `research/xhh-workshop/`，**未修改上游任何文件**）。

## 1. 项目基本信息（实测事实，非 README 宣称）

| 项 | 值 | 证据 |
|---|---|---|
| 克隆提交 | `3f1ca9aee836691f134a2c744ff64fe6f3534ef6`，`Mon Jun 15 01:33:36 2026 +0000`，`chore(sakura): add reflection for PR#2` | `git log -1` |
| 工作区成员 | `xhh-core` / `xhh-cli` / `xhh-agent` / `xhh-app` / `xhh-http` | `Cargo.toml` |
| 版本 / edition / MSRV | `0.1.0` / `2021` / `rust-version = "1.81"` | `Cargo.toml` |
| **许可证** | **`GPL-3.0-only`**（`[workspace.package] license`），根目录 `LICENSE` 为 GPLv3 全文 | `Cargo.toml`、`LICENSE` |
| 核心库规模 | `xhh-core/src` 共 **17 个 .rs 文件**，约 100 KB 源码 | 文件枚举 |
| 上游路径封装数 | **35 个不同路径**（脚本统计） | `research/probe/count_paths.py` → `docs/_paths.txt` |
| `#![forbid(unsafe_code)]` | 是 | `crates/xhh-core/src/lib.rs:7` |
| 数据模型 | **几乎为空**：`crates/xhh-core/src/models/mod.rs` 全文只有一行注释「数据模型（占位，后续逐步添加 PostLink/Comment/User 等结构体）」 | 直接读取该文件 |

主要依赖（`crates/xhh-core/Cargo.toml`）：`tokio`、`reqwest 0.12`（`rustls-tls` + `json` + `cookies` + `stream`，**默认特性关闭**）、`serde`/`serde_json`、`thiserror`/`anyhow`、`tracing`、`md-5`、`sha1`、`sha2`、`hmac`、`base64`、`hex`、`form_urlencoded`、`url`、`chrono`、`rand`、`uuid`、`directories`、`qrcode`、`image`；可选 `utoipa`（`schema` feature）。

## 2. 覆盖矩阵（35 个路径逐条判定）

图例：✅ 可直接复用 ｜ ⚠️ 需适配 ｜ ❌ 缺失/不可用 ｜ 🔴 待验证

### 2.1 基础设施

| 模块 | 判定 | 说明 |
|---|---|---|
| `hkey.rs::generate_hkey` | ✅ **可直接复用（最高价值）** | 与网页 JS 独立还原出的算法**完全一致**：字符集 `AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89`、路径归一化 `/a/b/c/`、三段字符替换→交错取 20→MD5→前 5 位替换 + 后 6 位混合 %100 → **7 字符**。本次用独立 Python 复刻后与 2 个回归向量一致，且真实请求全部成功 |
| `hkey.rs::get_nonce` | ✅ 可复用 | `MD5(ts + randint(0,1e9)).toUpperCase()`。与网页端公式**不同**，但**实测服务端只校验格式（32 位大写十六进制）**，不校验推导 |
| `hkey.rs::build_query_params` | ⚠️ 需适配 | 多传了网页端没有的 `device_info`、`_notip`（实测无害）；`web_version` 硬编码 `2.5` 而网页端读 meta 得 `3.0`（只读接口实测均通过） |
| `client.rs::XhhClient::request` | ⚠️ 需适配 | ① 用 `redirect::Policy::none()`，需确认图片/分享链接场景 ② 只按 `status` 之外的方式处理错误：**HTTP 非 2xx 才报错，而业务失败恒为 HTTP 200**，因此必须在上层再检查 body 的 `status` 字段 ③ 无重试/退避、无限流 |
| `crypto.rs::generate_token_id` | ⚠️ 需适配 | 生成的 `x_xhh_tokenid` 与网页端来源不同（网页端来自**设备指纹 SDK 的 `getDeviceId()`**，且网页代码**只写不读**）。权限不明，建议保留但不要依赖 |
| `config.rs` | ⚠️ 需适配 | 存 `%APPDATA%/xhh/config.json`，与需求「用户信息尽量保存在安装位置」冲突；且 `pkey` 明文落盘。`has_credentials()` 只查 `pkey`/`heybox_id` 非空，**不能反映会话是否已过期** |

### 2.2 信息流与帖子

| 路径 | 函数 | 判定 | 具体问题 |
|---|---|---|---|
| `/bbs/app/feeds` | `feed.rs::feeds` | ⚠️ 可复用但语义受限 | ① `pull` **硬编码为 1**，而**网页端实际用 `pull:0`** ② 用 `page` 翻页，而**网页端用 `offset`**（`getNextPageParam` 每次 +30）③ `limit` 传了但**服务端基本忽略** ④ **该流非确定性**（两次相同请求交集 0/10），`page` 是否真的翻页**无法验证** ⑤ `topic_id` 参数**不是过滤**（3/11 命中） |
| `/bbs/app/topic/feeds` | `feed.rs::community_feeds` | ⚠️ 可复用（归属严格） | ① `limit` 在服务端是**必传**，而结构体定义为 `Option<u32>` → **不传会直接失败**（`请求参数 "limit" 缺失`）→ 必须改为必填或给默认值 ② 该流**非确定性**（交集 0/18），`offset` 意义有限 ③ **未封装 `lastval` 之外的分页语义**（实测 `lastval` 恒为空） |
| **`/bbs/app/topic/feeds/news`** | — | ❌ **缺失（最关键缺口）** | 这是本次唯一被证实「确定性 + `lastval` 游标可靠」的社区列表，`xhh-core` **完全没有封装**。若不补，社区过滤只能建立在非确定性流上 |
| `/bbs/app/link/tree` | `feed.rs::post_detail` | 🔴 待验证 | 匿名调用返回 `status:"show_captcha"`。参数注释中的 `index`（1=热门/2=正序/3=倒序）**在网页端只观察到 `index:1`**，属未验证断言；网页端真实实参为 `page`(从1) / `is_first`(page==1?1:0) / `limit`(20) / `owner_only`(0) / `index`(1)，翻页依据 `has_more_floors` —— **这些 `xhh-core` 都没体现**（结构体注释称 `is_first`「首次加载 1，翻页 0」，与网页一致；但未提 `has_more_floors`） |
| `/bbs/app/profile/events` | `feed.rs::user_events` | ✅ 可直接复用 | 实测通过（`moments[32]`、`lastval='1790135667.844'`）。⚠️ 上游把 `list_type`/`dw` 硬编码为 `moment`/`628` |

### 2.3 社区／分区

| 路径 | 判定 | 说明 |
|---|---|---|
| `/bbs/app/api/post_editor/topic_selection/index` | ⚠️ 可复用但用途有限 | 实测 `topic_list` **只有 4 条**（`rec_src:"topic_hot"`），**不是完整社区目录**。上游把它当"推荐社区"用是对的，但要当目录用会严重不足 |
| `/bbs/app/api/post_editor/topic_selection/search` | ✅ 可复用 | 实测通过（`only_hashtag=0` → 23 条社区）。这是**社区搜索**的正确入口 |
| **`/bbs/app/topic/categories`** | ❌ **缺失** | 网页端读取 `result.latest_hot_topics.children` 作为社区目录（`webjs/index-TG6UTXfP.js`），匿名实测可调、递归出 **75 个** `topic_id`。**这是构建"社区多选列表"的首选数据源**，上游未封装 |
| **`/bbs/app/topic/menu`** | ❌ **缺失** | 网页端**唯一**的社区详情接口（`{topic_id, appid}` → `result.topic` + `result.menu[]`）。`menu[].type` 决定用哪个列表接口（`link`→`topic/feeds`，`news`→`topic/feeds/news`）。**没有它就无法知道社区有哪些 tab / 该用哪个接口** |
| **`/bbs/app/feeds/banner`** | ❌ 缺失 | 网页端首屏顶部社区图标栏（`topic_banner.top_topics` / `subscribed_topics`） |

### 2.4 评论

| 路径 | 函数 | 判定 | 问题 |
|---|---|---|---|
| `/bbs/app/link/tree`（评论来源） | `feed.rs::post_detail` | 🔴 待验证 | 评论列表的唯一可用来源，但被验证码拦截 |
| `/bbs/app/link/game/comments` | `comment.rs::list_comments` | ❌ **证据冲突** | 上游标 `#[deprecated]`，注释称「2026-06-11 抓包确认 Web 端不再调用，实测返回 `请求失败了`」；但**本次在网页 JS 中仍检索到该路径字面量**（`webjs/section-footer...js`）。→ 结论：**该接口状态不明**，建议以 `link/tree` 为准，不要依赖它 |
| `/bbs/app/comment/sub/comments` | `comment.rs::list_sub_comments` | ✅ 签名正确 | 网页端实参确认为 `{root_comment_id, lastval=末条子评论的 commentid}`，响应 `result.comments[]` + **`result.has_more`**（上游未提及 `has_more`）。🔴 需登录态才能验证 |
| `/bbs/app/comment/create` | `comment.rs::create_comment` | ⚠️ **很可能不可用** | ① 上游参数名与网页一致（`is_cy/link_id/reply_id/root_id/text`）✅ ② **但图片字段格式不同**：上游把 `imgs` 序列化为 **JSON 数组**，网页端是**分号 `;` 拼接的字符串** ③ **上游未实现第二套签名 `_rnd`**，而网页端对该接口显式传 `config{rnd:"15"}` 触发 `HMAC-SHA256` → **很可能被服务端拒绝** |
| `/bbs/app/comment/support` | `interaction.rs::toggle_like_comment` | ⚠️ 冲突 | 上游注释称 `support_type=2` 为 toggle 点赞；网页端 `support_type` **1=有用 / 2=取消(踩)**。需实测 |
| `/bbs/app/comment/delete` | `comment.rs::delete_comment` | ✅ 结构合理 | 未提交 |

### 2.5 互动与用户关系

| 路径 | 函数 | 判定 | 问题 |
|---|---|---|---|
| `/bbs/app/profile/award/link` | `interaction.rs::like_post` | ✅ **与网页一致** | 网页端 body 同为 `{link_id, award_type:1\|0}`，且同为**显式非 toggle**。上游注释「调用方需根据 `is_award_link` 判断状态」正确 |
| `/bbs/app/link/favour` | `interaction.rs::toggle_favourite` | ⚠️ **参数名错误** | 上游传 `fav_folder_id`；**网页端真实字段是 `folder_id`**，且需要 `userid` + `favour_type`（1/2，显式非 toggle）。→ **直接照抄会失败** |
| `/bbs/app/profile/fav/folders` | `interaction.rs::favourite_folders` | ✅ 可复用 | 实测匿名 → `status:"login"`，可作为会话探测（但更推荐 `/account/restore_login`） |
| `/bbs/app/profile/fav/folder/add` | `create_favourite_folder` | ✅ 结构合理 | 网页端 body 同为 `{name}` |
| `/bbs/app/profile/fav/folder/v2/links` | `favourite_folder_links` | ⚠️ 需补参数 | 网页端实参为 `{enable_new_style_collect:1, dw, offset, limit}`，响应 `result.links[]` + **`result.has_next`**（上游未提及 `has_next`） |
| `/bbs/app/profile/follow/user` | `user.rs::follow_user` | ⚠️ **参数名冲突** | 上游传 `{userid}`；**网页端传 `{link_id, following_id}`**。→ 必须实测确认 |
| `/bbs/app/profile/follow/user/cancel` | `unfollow_user` | ⚠️ 同上 | 同上 |
| `/bbs/app/profile/build/relation/` | `build_relation` | ✅ 结构合理 | 网页端为 `{relation_type:-1, userid}`，一致（注意上游路径尾部多一个 `/`，归一化后等价） |
| `/bbs/app/profile/following/list` | `user.rs::following_list` | ❌ **取不到数据** | **该接口把数据直接放在响应顶层**（`follow_list` / `follow_cnt` / `summary_url`），**没有 `result` 包装**；上游实现按 `result` 语义使用 → **会拿到空**。本次实测确认（`follow_list[159]`）。网页端也**找不到带实参的调用点**，本次**实测验证了 `userid` 参数可用** |
| `/bbs/app/profile/follower/list` | `user.rs::follower_list` | ⚠️ **同样顶层返回** | 实测 `userid` + `offset` + `limit` 可用（`limit=5` → 5 条），但同样无 `result` 包装 |

### 2.6 搜索与其它

| 路径 | 函数 | 判定 | 问题 |
|---|---|---|---|
| `/bbs/app/api/general/search/v1` | `search.rs::search` | ✅ 可复用 | 实测 `general`/`link`/`user`/`hashtag`/`game`/`mall` 均返回 `ok`。⚠️ ① 上游硬编码 `no_more=false`、`dw=628`，网页端用 `limit=30`、`dw=容器宽-32` ② 上游多传 `topic_id` 实现社区限定（网页端未使用该参数，但**实测生效且严格 3/3**）③ **上游未实现排序/时间筛选参数 `filter_tag`、`time_range`** |
| `/bbs/app/api/search/found` | `search_found` | ✅ 实测通过 | 网页端实参为 `{force_refresh}` |
| `/bbs/app/api/search/welcome_page/v2` | `search_welcome_page` | ✅ 实测通过 | — |
| `/bbs/app/api/emojis/list` | `emoji.rs::list_emojis` | ✅ 实测通过 | 网页端按 `type===1 \|\| type===3` 过滤显示（上游注释一致） |
| `/bbs/app/user/message` | `notification.rs::list_messages` | 🔴 待验证 | 匿名返回 `status:ok` 但 `messages:[]`。网页端互动消息实际用 `/bbs/notify/official_msg_v2/list`（`{offset, limit, lastval, sub_entry?}`）→ **上游可能封装了错误的接口**，建议两者都试 |
| `/bbs/app/api/qcloud/cos/upload/{info,token,callback}/v2` | `upload.rs` | ✅ 实现完整（未提交） | COS V5 HMAC-SHA1 签名、`put_to_cos` 逻辑完整。常量 `bucket=imgheybox-1251007209`、`region=ap-shanghai`、CDN `imgheybox.max-c.com` |
| `/bbs/app/api/link/post`、`/video-link/post`、`/link/delete` | `post.rs` | ⚠️ 需适配 | ① `link_tag` 注释错误（见 `00-总览与结论.md` §3.2）② 网页端发帖 body 还包含 `linkid`、`userid`、`thumb`、`is_award_link`、`is_favour`、`multidimensional_score` 等字段 ③ **未实现 `_rnd` 第二套签名** |
| `/account/get_qrcode_url/`、`/account/qr_state/` | `auth.rs` | ✅ **高质量可复用** | 三阶段设计（获取→单次轮询→提取凭据）适合 Tauri 异步；`extract_cookie_value` 直接解析原始 `Set-Cookie`，比依赖 `reqwest::cookies` 稳健。⚠️ ① `expire` 兜底默认 `300`，**实测服务端返回 `120`**，必须以服务端值为准 ② 未处理 `status:"need_google_check"` |

## 3. 缺失清单（网页端有、xhh-core 没有）

按对本次需求的重要性排序：

| 优先级 | 缺失接口 | 为什么需要 |
|---|---|---|
| **P0** | `/bbs/app/topic/feeds/news` | 唯一「确定性 + 游标可靠」的社区帖子列表 → **社区过滤方案的地基** |
| **P0** | `/bbs/app/topic/menu` | 唯一的社区详情接口；提供社区名、图标与 **tab 列表**（决定用 `feeds` 还是 `feeds/news`） |
| **P0** | `/bbs/app/topic/categories` | 社区目录（75 个 `topic_id`），**多选社区 UI 的数据源** |
| **P1** | `/account/restore_login` | 网页端的标准登录态检查（比"调收藏夹靠 `status:login` 探测"干净） |
| **P1** | `/bbs/app/feeds/banner` | 首屏顶部社区图标栏（贴合官方布局需要） |
| **P1** | `_rnd` 第二套签名（HMAC-SHA256） | 评论创建必需，否则可能被拒 |
| **P2** | `/bbs/notify/official_msg_v2/list` | 互动消息（上游的 `/bbs/app/user/message` 疑似不是网页端在用路径） |
| **P2** | `/bbs/app/profile/user/link/list_v2` | 用户在社区内的投稿列表（`{list_type:"article", offset, limit:30, userid, dw}` → `result.total_page`） |
| **P2** | `/bbs/app/profile/history/visit` | 浏览历史（`{dw, type, offset, limit}` → `result.history_visit[]`） |
| **P3** | `/bbs/app/link/related/recommend_web`、`/bbs/app/link/author_info` | 帖子详情页的相关推荐与作者卡片 |
| **P3** | 游戏详情三变体 `/game/{,console/,mobile/}get_game_detail/` | 游戏社区页；网页端按 `game_type` 选择 |

另有 `xhh-core` 完全未涉及的**响应结构一致性风险**：网页端响应存在**两种包装形态**（多数 `{status,msg,result}`，而 `following/list`、`follower/list` 为**顶层直出**）。`xhh-core` 全部按 `result` 处理，**至少这 2 个接口取不到数据**。

## 4. 可直接复用 / 需适配 / 缺失 / 待验证 —— 汇总

**可直接复用（低风险）**
- `hkey.rs` 全量签名算法与 `build_query_params`（**本次已用独立实现交叉验证通过**）
- `auth.rs` 扫码登录三阶段（含 `Set-Cookie` 原始解析）
- `api/emoji.rs`、`api/search.rs::search_found/search_welcome_page/search`、`api/user.rs::user_profile`、`api/feed.rs::user_events`、`api/interaction.rs::like_post`
- `api/upload.rs` 的 COS 四步流程与 V5 签名（结构完整）

**需要适配（有明确缺陷，见上表）**
- `api/feed.rs::feeds`（`pull` 硬编码 1 → 网页端用 0；`page` → 网页端用 `offset`）
- `api/feed.rs::community_feeds`（`limit` 必须传，`Option` 会失败）
- `api/interaction.rs::toggle_favourite`（`fav_folder_id` → `folder_id`，且非 toggle）
- `api/user.rs::follow_user/unfollow_user`（`userid` → `following_id` + `link_id`）
- `api/user.rs::following_list/follower_list`（**顶层返回，无 `result`**）
- `api/comment.rs::create_comment`（`imgs` 应为 `;` 拼接；缺 `_rnd`）
- `api/comment.rs::list_sub_comments`（补 `result.has_more`）
- `api/interaction.rs::favourite_folder_links`（补 `result.has_next`、`dw`）
- `config.rs`（存储位置与需求冲突；明文凭据；`has_credentials()` 不反映过期）
- `client.rs`（业务失败为 HTTP 200，需在上层检查 `status`；无重试/限流）

**缺失（需自行实现）**
- `/bbs/app/topic/feeds/news`、`/bbs/app/topic/menu`、`/bbs/app/topic/categories`、`/bbs/app/feeds/banner`（**P0 社区三件套 + banner**）
- `/account/restore_login`、`/account/logout`
- `_rnd` HMAC-SHA256 签名
- `/bbs/notify/official_msg_v2/list`、`/bbs/app/profile/user/link/list_v2`、`/bbs/app/profile/history/visit`
- 统一的 `status` 状态机（`ok`/`failed`/`login`/`show_captcha`/`lack_token`）

**待验证（缺登录态，本次无法确认）**
- `/bbs/app/link/tree`（帖子正文与楼层结构、`has_more_floors`、`index` 取值语义）
- `/bbs/app/comment/*` 全部写接口与子评论读取
- 收藏、关注、拉黑、消息、投稿列表、浏览历史
- 所有写入接口的真实响应结构

## 5. 许可证影响（**必须在上手前决定**）

- `xhh-workshop` 的 `[workspace.package] license = "GPL-3.0-only"`，`LICENSE` 为 GPLv3 全文。**GPLv3 具有传染性**：若我们的闭源/专有客户端 **以链接方式依赖 `xhh-core`**（Rust 静态链接属于此列），整个客户端需以 GPL-3.0 兼容条款分发并提供完整对应源码。
- 三种可选路线：

| 路线 | 做法 | 代价 |
|---|---|---|
| **A. 只借鉴，不依赖（推荐）** | 只参考**接口契约与算法**（接口路径/参数/字段属于事实性信息，算法为通用实现），在我们的 Rust 侧**自行实现**签名与 API 客户端 | 需自己写一遍签名与错误处理（工作量约 1–2 天，且本次调研已把算法与参数完全写清） |
| B. 接受 GPL | 直接 `path`/`git` 依赖 `xhh-core`，整个客户端以 GPL-3.0 发布 | 需开源全部客户端代码，商业闭源不可行 |
| C. Sidecar 进程隔离 | 把 `xhh-core` 编译成独立可执行文件（如 `xhh-http`）以子进程 + HTTP 通信 | ① GPL 传染性在"独立进程 + 通用协议通信"下通常被认为边界清晰，但**仍有法律争议**，不是零风险 ② 需打包额外二进制、管理进程生命周期，且 `xhh-http` 的 35 个本地端点**不含我们最需要的社区三件套**，收益低 |

> 本次调研**不构成法律意见**。路线 A 的技术可行性最高：本报告 `01-接口表.md` 与 `research/web_endpoints.md` 已把签名算法、公共参数、35+ 接口的参数与字段写清，重写成本可控。
