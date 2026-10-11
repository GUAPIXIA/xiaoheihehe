# 交付物 5 — 面向 Tauri 2 客户端的接口适配建议

技术栈前提：Tauri 2 + React + TypeScript + Rust，仅 Windows 桌面端；页面贴合官方网页版布局与交互。
（本文件按你项目需求清单中的条目：不使用原生窗口 / 不允许拖拽调整大小 / 缩放 50–300 / 点击设置弹小窗 / 评论时禁用快捷键 / 动画 / 默认装 D 盘 / 用户信息存安装位置 / 屏蔽专区 逐项给出接口层配套建议。）

## 1. 分层建议：**签名与网络全部放 Rust 侧**

```
React (TS)                       Rust (Tauri commands)             上游
─────────────                    ─────────────────────             ──────
页面/组件  ──invoke("feed.list")──▶  ApiClient
                                   ├─ 签名层 hkey/nonce/_time
                                   ├─ 公共参数拼装
                                   ├─ Cookie 注入 + 状态机
                                   ├─ 限流/重试/缓存
                                   └─ reqwest ─────────────────▶ api.xiaoheihe.cn
```

**为什么不让前端直接请求**（强烈建议）：

1. **CORS / Origin 校验**：上游要求 `Referer: https://www.xiaoheihe.cn/`、`Origin: https://www.xiaoheihe.cn`。WebView2 里前端 `fetch` 到 `api.xiaoheihe.cn` 属跨域，会被预检与 CORS 策略阻拦；Rust 侧发请求完全绕过该问题（**也是官方网页端能用的原因——它同源**）。
2. **凭据保护**：Cookie / `pkey` 若进入 JS 上下文，任何 XSS 或第三方脚本都能读走。放 Rust 侧后前端只拿到业务数据。
3. **签名不可延迟**：`_time` 必须是请求发起瞬间的秒级时间戳（服务端有 ±1 秒级容忍）。前端算好再跨 IPC 传递会引入抖动，**在 Rust 内同步生成签名与参数**最稳。
4. 复用连接池、统一限流与重试、便于做磁盘缓存。

> 唯一注意点：本次实测证明 **`offset = 0`（`_time` 不加 1）即可通过只读接口**，但网页端源码用 `_time + 1` 签名。建议实现时**按 `xhh-core` 的约定**（发帖类 offset=1、其余 0），并对签名类失败做**一次 `_time+1` 重试**。

## 2. API 客户端设计（Rust）

### 2.1 必做：`status` 状态机

上游业务失败**恒为 HTTP 200**，必须在 Rust 侧把 body 的 `status` 映射为强类型错误：

```rust
enum ApiStatus { Ok, Failed, Login, ShowCaptcha, LackToken, Unknown(String) }

match status.as_str() {
    "ok"          => Ok(payload),
    "login"       => Err(ApiError::SessionExpired),       // → 前端弹登录二维码
    "show_captcha"=> Err(ApiError::CaptchaRequired),      // → 不要自动绕过；提示用户去官方 App/网页完成
    "lack_token"  => Err(ApiError::TokenStale { retry: true }),
    "failed"      => Err(ApiError::Rejected(msg)),        // 如 "pull 参数不正确 (0/1)"
    other         => Err(ApiError::Unknown(other.into())),
}
```

- **`lack_token` 的重放**：网页端做法是重新获取 `x_xhh_tokenid` 后**重放一次**原请求。Rust 侧实现「重放一次、仅一次」的守卫，避免死循环。
- **`show_captcha` 不要自动处理**：本次调研明确未尝试绕过腾讯 TCaptcha。客户端应提示「该内容需要在官方客户端/网页完成验证」并停止自动重试。

### 2.2 限流、重试与缓存（防封与体验）

- **全局令牌桶**：建议 ≤5 req/s、并发 ≤6。社区聚合场景下（`k` 个社区 × 每次刷新）很容易超；必须由 Rust 侧统一排队。
- **重试**：只对**网络错误 / 5xx / `lack_token`** 重试；对 `login` / `show_captcha` / `failed` **不重试**（重试无用且加重风控）。退避用指数 + 抖动，最多 2 次。
- **缓存分层**（Rust 侧，落地到安装目录缓存文件）：
  | 数据 | TTL | 说明 |
  |---|---|---|
  | 社区目录 `topic/categories`、`feeds/banner` | 6–24 h | 变化慢，启动即用 |
  | 社区详情 `topic/menu` | 1–6 h | 每个社区一次，数量可控 |
  | 社区列表页 `topic/feeds/news` | 5–10 min（按 `topic_id`+`lastval` 键） | **该接口确定性 → 可安全缓存** |
  | 综合流 `feeds` | 不缓存（非确定性） | 缓存会造成"内容冻结"的错觉 |
  | Emoji `emojis/list` | 24 h | 基本不变 |
  | 帖子详情 `link/tree` | 1–5 min | 受 `status:"show_captcha"` 影响，缓存命中可减少请求 |
- **每请求必带 `device_id` 且稳定**：`device_id` 参与签名参数与风控画像，**必须在首次启动生成并持久化**，不要每次启动换新（`xhh-core` 的行为正是持久化到 config，可借鉴）。

### 2.3 分布式/会话数据存储（对应"用户信息存安装位置 + 默认装 D 盘"）

| 数据 | 建议位置 | 安全措施 |
|---|---|---|
| 安装目录 | 安装器默认目标 `D:\<AppName>`（NSIS `InstallDir` 可设默认值） | — |
| 应用设置（社区过滤、主题、缩放、快捷键） | `<InstallDir>\data\settings.json` | 明文可接受（非敏感） |
| 会话凭据（`user_pkey`、`heybox_id`） | `<InstallDir>\data\credentials.dat` | **不要明文**：用 Windows DPAPI（`CryptProtectData`，绑定当前用户）或 `keyring` crate；若坚持"必须在安装目录"，则必须 DPAPI 加密后再落盘 |
| 缓存 | `<InstallDir>\data\cache\` | 可随时删除 |

⚠️ 两个坑：
1. **安装目录可能需要管理员权限写入**。若装在 `D:\Program Files\...` 会失败。建议安装器默认到 `D:\<AppName>`（非 Program Files），并在运行时对写入失败做降级（回退到 `%LOCALAPPDATA%`）并提示用户。
2. **便携性 vs 多用户**：装在安装目录意味着多用户共用同一份凭据/设置。若只面向单机单用户（你的场景）可接受，需在文档里写明。

## 3. 前端（React）适配要点

### 3.1 状态与数据层

- **不要把上游响应直接塞进 React state**：上游 JSON 字段风格极不一致（`avatar` / `avartar` 双写、`linkid` vs `link_id`、`description` vs `desc`、顶层 vs `result` 包装）。**在 Rust 侧或 TS 的适配层统一归一化**成一个稳定的 `Post`/`Community`/`Comment` 领域模型，UI 只依赖领域模型。
  - 已知必须兼容的"脏数据"：`user.avartar` 与 `user.avatar` 同时存在；`following/list`、`follower/list` **无 `result` 包装**；`news` 列表无 `create_at`/`user`；`content_type=18` 的广告卡无 `linkid`。
- **推荐 TanStack Query**：上游列表是"游标/偏移 + 无限滚动"形态，`useInfiniteQuery` 的 `getNextPageParam` 与网页端同构（`report4.md` 已给出网页端的真实 `getNextPageParam`），迁移成本低。
- **社区过滤**：把过滤集合放进一个 Context/Store，**过滤在数据层做**（Rust 侧或 Query `select`），不要在每个组件里各过滤一遍，否则分页与去重会不一致（必须按 `linkid` 全局去重，跨社区重复是预期行为）。

### 3.2 视觉与交互贴合官方网页版

- 网页端是 **Vue 3 + Vite** 的 SPA（`research/webjs/` 中大量 `*_vue_type_*` chunk），组件前缀为 `hb-*`（`hb-bbs-home`、`hb-cpt`、`hb-alert`、`hb-icon`、`hb-webp`、`hb-loading`、`hb-star`）。
- 本次调研**聚焦接口，未系统提取样式 token**（CSS 产物为 `.../app/index-B413ANO2.css`，未分析）。**已从接口响应中拿到的少量颜色**可用于 tab 配色起步：社区 tab `#5662E4`、头条 tab `#3E8AE2`、游戏 tab `#64696E`（来自 `/bbs/app/topic/menu` 的 `menu[].color`）。
- 建议的还原做法：单独抓取 `index-B413ANO2.css` 提取颜色/圆角/间距/字体，建立 design token；**不要靠肉眼比对截图**。
- **窗口尺寸影响请求参数**：网页端列表请求会带 `dw = 容器宽 - 56`（社区页/首页）或 `-32`（搜索页）。这是**布局宽度参数**，会影响服务端返回的卡片形态（如缩略图尺寸）。我们的窗口不允许拖拽调整大小、缩放 50–300%，因此 `dw` 应按**当前缩放后的实际内容宽度**计算，而不是固定值。
- 动画/主题/设置小窗/快捷键禁用（评论时）都是纯前端事项，与接口无耦合；唯一接口相关的点是：**评论提交前需确认登录态**（否则直接吃 `status:"login"`），以及**评论提交要带 `_rnd` 签名**（见 §4）。

### 3.3 图片与视频（CSP 与防盗链）

- 资源域名（实测来自响应字段）：`imgheybox.max-c.com`、`imgheybox1.max-c.com`（图片/CDN，带 `imageMogr2` 缩放参数）、`cdn.max-c.com`（社区图标）、`static.max-c.com`（网页 JS/CSS）。
- Tauri 的 CSP 需放行这些域名（`img-src` / `media-src`），否则图片空白。
- `imgs[]` / `thumbs[]` 是**数组**，同一张图有 thumb 与原图两个 URL；`thumbs` 已带 `thumbnail/850x1450>` 后缀，列表页优先用 `thumbs`。
- 视频：`video_url` / `video_thumb` / `video_info` / `duration` 字段**只在 `/bbs/app/feeds` 的条目上观察到**，`topic/feeds` 与 `news` 样本中未出现 → **视频帖在社区头条/社区列表里的字段完整性【待验证】**，实现视频播放前需先验证。
- 不要用 WebView 直接播放不可信视频源；建议仅支持 `has_video=1` 且 URL 域名在白名单内的资源。

## 4. 必须自行补齐的接口层能力（`xhh-core` 没有）

| 能力 | 必要性 | 说明 |
|---|---|---|
| `_rnd` 第二套签名（HMAC-SHA256） | **高** | 网页端对 `/bbs/app/comment/create` 显式带 `config{rnd:"15"}` → 参数 `_rnd = "15:" + HMAC_SHA256(key="Z7mFG4tQp9Ws2LxB8H", msg=key+nonce+(_time+":"+nonce))`。**不实现很可能发评论失败** |
| 社区三件套 | **高** | `/bbs/app/topic/categories`、`/bbs/app/topic/menu`、`/bbs/app/topic/feeds/news` |
| `/account/restore_login` | 中 | 标准登录态检查（比依赖 `fav/folders` 的 `status:"login"` 更干净） |
| `/account/logout` | 中 | 退出登录（你需求清单里的"退出方式"） |
| `feed → Post` 归一化层 | **高** | 三种列表源字段不一致（见 §3.1） |
| `status` 状态机 + 一次性重放 | **高** | 见 §2.1 |

## 5. 合规与风控红线（建议写进产品文档）

1. **不实现验证码绕过**：遇到 `show_captcha` 只做提示。这既是本次调研的边界，也是避免账号风险的关键。
2. **不做批量采集**：社区聚合的请求量必须由"用户可见范围"驱动（懒加载 + TTL 缓存），不要后台预取全部社区。
3. **写入操作要节流**：点赞/收藏/关注等按用户显式操作触发，不做自动化；`award_type` 与 `favour_type` 都是**显式指定**语义（不是 toggle），重复点击前应先读状态，避免误发。
4. **`device_id` 不要伪造轮换**：稳定持久化一个即可；随机轮换容易被判定为异常。
5. **明示第三方身份**：README 声明与官方无关，并提示使用风险（上游项目也是这么做的）。

## 6. 建议的里程碑落地顺序

| 阶段 | 内容 | 依赖的接口 | 风险 |
|---|---|---|---|
| M1 | Rust API 客户端骨架：签名 + 公共参数 + `status` 状态机 + 限流（**先用匿名只读接口打通**） | `/bbs/app/feeds`、`/bbs/app/api/emojis/list` | 低（本次已实测可用） |
| M2 | 扫码登录 + 凭据加密存储 + 会话过期处理 | `/account/get_qrcode_url/`、`/account/qr_state/`、`/account/restore_login` | 中（`restore_login` 待验证） |
| M3 | 首页信息流 + 帖子详情 + 评论 | `/bbs/app/feeds`、`/bbs/app/link/tree`、`/bbs/app/comment/sub/comments` | **高**（`link/tree` 待验证，是 M3 的硬前置） |
| M4 | **社区过滤（含/屏蔽）** | `/bbs/app/topic/categories`、`/bbs/app/topic/menu`、`/bbs/app/topic/feeds/news` | 中（方案已定，见 `04`） |
| M5 | 搜索 + 个人主页 + 收藏 + 消息 | 搜索系列、`/bbs/app/profile/*` | 中（部分需登录验证） |
| M6 | 常规互动（点赞/收藏/关注/发评论） | 各 POST 接口 + `_rnd` | **高**（多处参数冲突 + 风控） |

> **建议 M1/M2 与 M3 并行推进**：M3 的阻塞点是"需要一次真实登录"来做 `link/tree` 验证（见 `06`），而这正好是 M2 的产物——所以先把登录打通，M3 的验证才能开始。
