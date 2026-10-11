# 小黑盒 Web 端 (xiaoheihe.cn/app/bbs/home) 后端接口侦察报告

> 范围：**只读源码/静态资源检查**。未对 `api.xiaoheihe.cn` 发起任何请求，未登录，未发送任何凭据。
> 产物目录：`D:\Code\xiaoheihehe\research\webjs\`（80 个 JS 文件，共 6,078,482 字节）
> 本次未修改 `research\xhh-workshop` 或任何其他既有文件。

UI 版本线索（来自 `research\official_home.html`）：`heybox-project=website`，`heybox-version=1.2.39`，
`heybox-sha=b2150e4c853681b34e9bd565222d9a7db674b920`，`web_version=3.0`，API 客户端里另写死 `version:"999.0.4"`。

---

## 方法与证据范围

### 1. 站点 HTML（只 GET 一次，此前已存在）

| 文件 | 本地路径 | 大小 |
|---|---|---|
| https://xiaoheihe.cn/app/bbs/home（HTML shell） | `research\official_home.html` | 3,481 B |

### 2. 主 bundle

| URL | 本地路径 | 大小 |
|---|---|---|
| https://static.max-c.com/static/heybox/webapp/@heybox-spa/website/app/index-CnBGc0ax.js | `research\webjs\index-CnBGc0ax.js` | 2,002,476 B |

下载方式：`Invoke-WebRequest -UseBasicParsing` + Chrome UA。

### 3. 懒加载 chunk 清单：**解析成功**

这是 Vite 构建（不是 Angular CLI），因此没有 Angular 的 `loadChildren`（全 bundle `loadChildren` 出现 0 次）。
chunk 清单以 Vite 的 `__vite__mapDeps` 形式内联在 `index-CnBGc0ax.js` 第 1 行：

```js
const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["app/index-cZbguqnj.js","app/index-CpsSnSan.js", ... ])))=>...
```

- 清单条目 138 条（js + css 混合），其中 **独立 JS chunk 77 个**；
- 与 bundle 内联 `import("./index-XXXX.js")` 相对路径做并集后共 **79 个 hashed chunk**；
- 递归扫描（4 轮）后集合闭合，额外发现 1 个：`video.es-Dx37Ufdt.js`；
- 因此**全部 chunk 都已下载**（不需要按关键词挑拣），并且**未下载任何 `-legacy-` 变体**。

chunk URL 解析规则：chunk 名相对于 `.../website/`，因此
`https://static.max-c.com/static/heybox/webapp/@heybox-spa/website/` + `<chunkname>`
（已用 HEAD 请求验证：`index-cZbguqnj.js` → 200，`Content-Type: application/javascript`）。

### 4. 已下载的全部 80 个 JS 文件（大小 B）

```
index-CnBGc0ax.js                                        2002476   ← 主 bundle
video.es-Dx37Ufdt.js                                      637140
section-footer.vue_vue_type_style_index_0_lang-Dv8EuLv4.js 514515
index-QyGRQrYB.js                                         503171
index.vue_vue_type_style_index_0_lang-CAQc-KHV.js         334496
cpt-editor-publish.vue_vue_type_style_index_0_lang-DFMhpHCR.js 319871
index-kg6ORna0.js                                         293845
index.vue_vue_type_script_setup_true_lang-CczlcyPk.js      241106
UploadItem-CjDFnmgd.js                                    175771
index-B6998Rwh.js                                         129823
index-DhaEGdEI.js                                         108692
Extension-8SRztW9Y.js                                      89665
index-D_mYS5_Z.js                                          76905
swiper-bundle-DBgHbtO-.js                                  69101
menu-vote.vue_vue_type_style_index_0_lang-ClamgeT8.js       67849
index-Cyf6fCgP.js                                          61897
index-CH1Fl4gq.js                                          60433
index-DqPpWXns.js                                          29747
index.vue_vue_type_style_index_0_lang-DHma0rl3.js           23599
index.vue_vue_type_style_index_0_lang-DHma0rl3.js 等共 80 个（完整列表见 webjs 目录）
```

**总计 6,078,482 字节**（远低于 80 MB 上限）。

### 5. 未能解析 / 未做的事

- **未解析 sourcemap**：chunk 尾部有 `//# sourceMappingURL=xxx.js.map` 注释，但本次未下载 `.map`（未在原任务授权范围内），因此所有函数名都是压缩后的短名，字段语义只能靠调用点推断。
- **未动态执行、未抓包**：所有结论均来自静态字符串/调用点，没有真实网络流量比对。
- **未调用 api.xiaoheihe.cn**（按要求由其他 agent 负责）。
- `app/index-Dcvuqx_5.css` 等 CSS 未下载（不影响接口发现）。
- 未下载 `polyfills-B5F1fjDr.js` / `index-legacy-BS_2rJKY.js`（legacy 变体按要求跳过）。

### 6. 证据分级说明（重要）

本报告中：
- **高** = 既看到路径字面量，又看到它出现在**请求构造函数**里，且找到了**带对象字面量实参的调用点**（能读出参数名）。
- **中** = 看到路径字面量 + 请求构造函数，但**没找到调用点实参**（参数名未知）。
- **低** = 只在非请求上下文（例如验证码 appid 白名单、路由表、文档字符串）里出现过该字面量，**未观察到网页真的调用它**。

---

## 在网页 JS 中观察到的接口

> 说明：所有路径都拼在 `baseURL = https://api.xiaoheihe.cn`（见下文 `<公共参数>` 的 `Pk` 表）。
> 请求封装有两个客户端：`En`（axios，导出别名 `H`）与 `Hr`（客户端/hybrid 传输，导出别名 `b`），签名一致：
> `$get(url, params, config)` / `$post(url, params, data, config)` —— **第 2 个参数是 query，第 3 个参数是 body**。

### 6.1 社区 / 分区 / 信息流

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/app/feeds` | index-TG6UTXfP.js | `const it="/bbs/app/feeds";function at(_,a){return x.$get(it,_,a)}`；调用点 `await at({pull:0,offset:e,dw:(((d=c.value)==null?void 0:d.clientWidth)\|\|660)-56},{signal:o})` | **query**: `pull`, `offset`, `dw`（`getNextPageParam:(e,o,t)=>{if(e)return t+Pt}`，`Pt` 为页步长常量）。**未发送 `topic_id`** | 高 |
| `/bbs/app/feeds/banner` | index-TG6UTXfP.js | `const ct="/bbs/app/feeds/banner";function rt(_,a){return x.$get(ct,_,a)}`；调用点 `await rt({},{signal:e})` | **query**: 无（空对象）。响应取 `result.topic_banner.top_topics`（`slice(1)`）与 `result.topic_banner.subscribed_topics` | 高 |
| `/bbs/app/topic/categories` | index-TG6UTXfP.js | `const ut="/bbs/app/topic/categories";function lt(_,a){return x.$get(ut,_,a)}`；调用点 `await lt({},{signal:c})` | **query**: 无。响应取 `result.latest_hot_topics.children`（页面只 `slice(0,5)` 展示，子项字段含 `topic_id`/`name`/`small_pic_url`） | 高 |
| `/bbs/app/topic/feeds` | index-CttNF2ng.js | `const vt="/bbs/app/topic/feeds";function gt(I,u){return fe.$get(vt,I,u)}`；调用点见下 | **query**: `topic_id`, `offset`, `limit`, `lastval`, `sort_filter`, `dw`，再展开 `...menuItem.params`（菜单项来自 `/bbs/app/topic/menu`） | 高 |
| `/bbs/app/topic/feeds/news` | index-CttNF2ng.js | `const ht="/bbs/app/topic/feeds/news";function yt(I,u){return fe.$get(ht,I,u)}`；`o=(a==null?void 0:a.type)==="link"?gt:yt` | **query**: 与 `/bbs/app/topic/feeds` 完全同一份参数对象 | 高 |
| `/bbs/app/topic/menu` | section-footer…-Dv8EuLv4.js（`export{... bu as h}`） | `const wd="/bbs/app/topic/menu";function bu(D,Z){return mo.$get(wd,D,Z)}`；调用点（index-CttNF2ng.js）`await ct({topic_id:v.value\|\|void 0,appid:G.value\|\|void 0},{signal:e})` | **query**: `topic_id`, `appid`。响应取 `result.topic` | 高 |
| `/bbs/app/api/topic/index` | index-D_mYS5_Z.js | `const sr="/bbs/app/api/topic/index";function ur(e,r){return Ue.$get(sr,e,r)}`；`await ur({is_post:1,post_tab:1,is_new_style:1,type:"list",need_award_bubble_info:1,link_id:e.linkId})` | **query**: `is_post`, `post_tab`, `is_new_style`, `type`, `need_award_bubble_info`, `link_id` | 高 |

`/bbs/app/topic/feeds` 的完整调用点（index-CttNF2ng.js）：

```js
queryFn: async ({pageParam:e, signal:t}) => {
  const a = be.value,                                   // 当前菜单项
        n = { topic_id: v.value, offset: e.offset, limit: e.limit,
              lastval: e.lastval, sort_filter: f.value || void 0,
              dw: ((E.value?.clientWidth) || 660) - 56,
              ...(a?.params ?? {}) };
  const o = a?.type === "link" ? gt : yt;               // gt=.../topic/feeds, yt=.../topic/feeds/news
  const {data:{result:s,status:_}} = await o(n, {signal:t});
  return _ !== "ok" ? null : s;
},
initialPageParam: { offset: 0, limit: St /* St=10 */, lastval: "" },
getNextPageParam: (e,t,a) => {
  if ((e?.links ?? []).length !== 0)
    return { offset: a.offset + a.limit, limit: It /* It=30 */, lastval: e?.lastval ?? "" };
},
```

→ 首屏 `limit=10`、翻页 `limit=30`；游标字段名是 **`lastval`**（不是 `last_val`）；排序字段名是 **`sort_filter`**。

### 6.2 帖子详情 / 评论

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/app/link/tree` | Extension-8SRztW9Y.js（`Nn as k`） | `const Ce="/bbs/app/link/tree";function Nn(s,t){return Me.$get(Ce,s,t)}`；调用点见下 | **query**: `link_id`, `is_first`, `page`, `index`, `limit`, `owner_only`, 可选 `root_comment_id`, 可选 `comment_id` | 高 |
| `/bbs/app/link/tree/v2` | index-CnBGc0ax.js | 仅出现在验证码 appid 白名单数组：`["/bbs/app/api/general/search/v1",...,"/bbs/app/link/tree/v2","/bbs/app/link/tree","/bbs/app/link/tree/backend",...]` | 未观察到调用 | 低 |
| `/bbs/app/link/tree/backend` | index-CnBGc0ax.js | 同上（同一白名单数组） | 未观察到调用 | 低 |
| `/bbs/app/comment/sub/comments` | index-CH1Fl4gq.js | `const Rn="/bbs/app/comment/sub/comments";function En(e,s){return Ee.$get(Rn,e,s)}`；`await En({root_comment_id:i,lastval:((q=(N=g==null?void 0:g.comment)==null?void 0:N.at(-1))==null?void 0:q.commentid)\|\|""})` | **query**: `root_comment_id`, `lastval`(末条评论的 `commentid`)。响应 `result.comments[]`、`result.has_more` | 高 |
| `/bbs/app/comment/create` | safe-route-BUtxpI_Y.js（`De as p`） | `const pe="/bbs/app/comment/create";function De(e,o,t){return v.$post(be,e,o,A(t))}`；调用点见下 | **query**: `{}`；**body**: `is_cy`, `link_id`, `reply_id`, `root_id`, `text`, 可选 `imgs`；**config**: `{rnd:"15"}` | 高 |
| `/bbs/app/comment/support` | index-CH1Fl4gq.js | `const Mn="/bbs/app/comment/support";function Hn(e,s,o){return Ee.$post(Mn,e,s,o)}`；`await Hn({},{comment_id:i,support_type:x?2:1})` | **query**: `{}`；**body**: `comment_id`, `support_type`（1=顶, 2=踩 取消） | 高 |
| `/bbs/app/comment/report` | safe-route-BUtxpI_Y.js | `const he="/bbs/app/comment/report"...function we(e,o,t){return v.$post(ke,e,o,A(t))}`；`a={object_type,report_desc,report_reason,link_id,comment_id}` → `we({},a)` | **query**: `{}`；**body**: `object_type`, `report_desc`, `report_reason`, `link_id`, `comment_id` | 高 |
| `/bbs/app/link/report` | safe-route-BUtxpI_Y.js | `const ve="/bbs/app/link/report"...function xe(e,o,t){return v.$post(Ae,e,o,A(t))}`；`_.value==="link"?xe({},a):we({},a)` | **body**: 同上报对象（`object_type` 为 `"link"`） | 高 |
| `/bbs/app/api/get/forbid_reason` | safe-route-BUtxpI_Y.js | `const fe="/bbs/app/api/get/forbid_reason"...function ye(e,o){return v.$get(de,e,A(o))}`；`await ye({type:"report",object_type:_.value,link_id:m.value})` | **query**: `type`(`"report"`), `object_type`, `link_id` | 高 |
| `/bbs/app/link/author_info` | safe-route-BUtxpI_Y.js | `const _e="/bbs/app/link/author_info"...function Ie(e,o){return v.$get(me,e,A(o))}`；`_.value==="link"?{link_id}:{comment_id}` | **query**: `link_id` 或 `comment_id` | 高 |
| `/bbs/app/link/related/recommend_web` | index-CH1Fl4gq.js | `const Ln="/bbs/app/link/related/recommend_web";function Bn(e,s){return Ee.$get(Ln,e,s)}`；`await Bn({link_id:o.value,device_info:"Chrome",h_src:Jt(17)})` | **query**: `link_id`, `device_info`(`"Chrome"`), `h_src`（17 位随机串，`kve(17)`=`generateRandomCharSequence`） | 高 |
| `/bbs/app/link/game/comments` | section-footer…-Dv8EuLv4.js | `const yd="/bbs/app/link/game/comments";function xd(D,Z){return mo.$get(yd,D,Z)}`；`await xd({appid:Z.appid,offset:U,limit:30,api_version:"4",sort_type:tt.value})` | **query**: `appid`, `offset`, `limit`, `api_version`, `sort_type`；响应 `result.total_page`、`result.links[]` | 高 |
| `/bbs/app/link/game/comment/up` | section-footer…-Dv8EuLv4.js | `const bd="/bbs/app/link/game/comment/up";function vd(D,Z,K){return mo.$post(bd,D,Z,K)}`；`vd({},{link_id:lt.linkid,support_type:0})`，`tagid=1`（happy 时） | **query**: `{}`；**body**: `link_id`, `support_type`(0/1/2), 可选 `tagid` | 高 |
| `/bbs/link/comment_permission/error_report` | index-CH1Fl4gq.js | `to="/web/website/bbs/link/comment_permission/error_report"` | ⚠️ **这是网页前端路由，不是接口** | 低（已排除） |

`/bbs/app/link/tree` 的完整调用点（index-CH1Fl4gq.js，`tn` = useInfiniteQuery 包装）：

```js
const h=["link_tree",e,u,r],
 {data:b, fetchNextPage:S, hasNextPage:f, isFetching:m, isLoading:_} = tn({
   queryKey: h,
   queryFn: async ({pageParam:i, signal:g}) => {
     const x = { link_id: De(e), is_first: i===1?1:0, page:i, index:1, limit:20, owner_only:0 };
     u.value && (x.root_comment_id = u.value);
     r.value && (x.comment_id = r.value);
     const {data:{result:M,status:R,msg:D}} = await mn(x, {signal:g});   // mn = Nn = GET /bbs/app/link/tree
     ...
   },
   initialPageParam: 1,
   getNextPageParam: (i,g,x) => { if (i?.has_more_floors) return x+1; }
 });
```

→ `/bbs/app/link/tree` 的评论分页走的是 **`page`+`index`+`limit`+`is_first`+`owner_only` 组合**，`page` 从 1 开始，翻页条件看响应里的 **`has_more_floors`**；
`root_comment_id` / `comment_id` 只在“定位到某个楼层/某条子评论”时才带上。

`/bbs/app/comment/create` 的完整调用点（index-CH1Fl4gq.js）：

```js
async function L(T,B,V){
  ...
  const Z = { is_cy: T.is_cy?1:0,
              link_id: String(n.link.linkid),
              reply_id: r.value ? String(r.value.commentid) : "-1",
              root_id:  h.value ? String(h.value.commentid) : "-1",
              text: T.text };
  T.images.length !== 0 && (Z.imgs = T.images.filter(Q=>Q.is_settle).map(Q=>Q.url).join(";"));
  const Q = await n.createComment(Z);   // → rn({}, Z, {rnd:"15"}) → POST /bbs/app/comment/create
}
```

→ 顶层评论 `root_id="-1"`、`reply_id="-1"`；图片用 **分号 `;` 拼接** 成 `imgs` 字符串。

### 6.3 搜索

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/app/api/general/search/v1` | index-CILLi-Eo.js（`export{t as g}`） | `const p="/bbs/app/api/general/search/v1";function t(e,r){return a.$get(p,e,r)}` | 见下两处调用点 | 高 |
| `/bbs/app/api/general/search/v1/web` | index-CnBGc0ax.js | 仅出现在验证码 appid 白名单数组里 | 未观察到调用 | 低 |
| `/bbs/app/api/search/suggestion/v2` | index.vue…-DHma0rl3.js | `const Ae="/bbs/app/api/search/suggestion/v2";function Ee(d,f){return j.$get(Ae,d,f)}`；`await Ee({q:n})` | **query**: `q`；响应 `result.suggestions` | 高 |
| `/bbs/app/api/search/welcome_page/v2` | index.vue…-DHma0rl3.js | `const Ie=".../welcome_page/v2";function Ze(d,f){return j.$get(Ie,d,f)}`；`await Ze({},{signal:e})` | **query**: 无；响应 `result.default_q` | 高 |
| `/bbs/app/api/search/found` | index.vue…-DHma0rl3.js | `const Oe="/bbs/app/api/search/found";function Pe(d,f){return j.$get(Oe,d,f)}`；`await Pe({force_refresh:Z.value>0},{signal:e})` | **query**: `force_refresh`(0/1) | 高 |
| `/bbs/app/api/at/search` | menu-at…-Da8RBsx5.js | `const Pe="/bbs/app/api/at/search";function Ae(a,f){return ne.$get(Pe,a,f)}`；`await Ae({q:E.value})` | **query**: `q`；响应 `result.users[]`（含 `userid`,`username`） | 高 |
| `/bbs/app/api/post_editor/topic_selection/search` | cpt-editor-publish…-DFMhpHCR.js | `const Md="/bbs/app/api/post_editor/topic_selection/search";function ba(n,t){return ji.$get(Md,n,t)}`；`await ba({q:k,only_hashtag:0})` | **query**: `q`, `only_hashtag`；响应 `result.search_result[]`，元素含 `search_type`(`"topic"`\|`"hashtag"`) | 高 |
| `/bbs/app/api/post_editor/topic_selection/index` | index-D_mYS5_Z.js | `const cr=".../topic_selection/index";function lr(e,r){return Ue.$get(cr,e,r)}`；`await lr({})` | **query**: 无；响应 `result.hashtag_list` | 高 |

搜索页调用点（index-Sbe-3Z-0.js，`Be`=useInfiniteQuery，`Ae`=general search）：

```js
const O = f(() => ({ q: e.query.q, search_type: s.value,
                     game_type:  s.value==="game" ? n.value : void 0,
                     time_range: s.value==="link" ? l.value : void 0,
                     filter_tag: m.value }));
await Ae({ q: e.query.q, search_type: s.value,
           game_type:  s.value==="game" ? n.value : void 0,
           time_range: s.value==="link" ? l.value : void 0,
           filter_tag: m.value,
           is_pull_down: 0, offset: _ || 0, limit: 30,
           dw: ((u.value?.$el.clientWidth) || 660) - 32 }, {signal:p});
// initialPageParam: 0 ; getNextPageParam: (_,p,d) => Ut(_,d)
```

搜索页 tab 名（同文件，源码常量）：
`[{label:"综合",name:"general"},{label:"内容",name:"link"},{label:"游戏",name:"game"},{label:"小程序",name:"mini_program"},{label:"用户",name:"user"},{label:"话题",name:"hashtag"},{label:"商品",name:"mall"}]`，
默认 `search_type` 为 `"general"`（`function I(_){return j(_)||"general"}`）。
**注意：没有独立的“社区/分区”搜索 tab**（分区/话题只能通过 `hashtag`/`general` 搜到）。

编辑器里复用同一接口搜游戏（cpt-editor-publish…-DFMhpHCR.js）：

```js
await bd({ q:T.value, game_type:w.value, search_type:"game",
           request_source:"edit_link", offset:b.offset, limit:b.limit });
```

### 6.4 登录 / 会话

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/account/get_qrcode_url/` | index-CnBGc0ax.js | `const _Ie="/account/get_qrcode_url/";function SIe(e,t){return En.$get(_Ie,e,t)}`；`await zIe({app:"web"}, ...)` | **query**: `app`(`"web"`)；响应 `result.qr_url`、`result.expire` | 高 |
| `/account/qr_state/` | index-CnBGc0ax.js | `const MIe="/account/qr_state/";function PIe(e,t){return En.$get(MIe,e,t)}` | **query**: `qr`（从 `qr_url` 的 querystring 里取 `qr` 参数）、`app:"web"`；响应 `status`（可为 `"need_google_check"`）、`result.error`（`"wait"` 等） | 高 |
| `/account/restore_login` | index-CnBGc0ax.js | `const DIe="/account/restore_login";function vj(e,t){return En.$get(DIe,e,t)}`；`await vj({},{signal:i,forbidden_auto_tologin:!0})` | **query**: `{}`；响应 `result.account_detail.userid`（随后写入 `heybox_id` cookie）。**这就是网页的“登录态检查”** | 高 |
| `/account/logout` | index-CnBGc0ax.js | `const OIe="/account/logout";function mj(e,t){return En.$get(OIe,e,t)}`；`await mj({})` | **query**: 无；随后清 `heybox_id` cookie | 高 |
| `/account/login/` | index-CnBGc0ax.js | `const TIe="/account/login/";function AIe(e,t,n){return En.$post(TIe,e,t,n)}`；`FIe(e,t={}){return (await AIe({},e,Bl(t))).data}` | **query**: `{}`；**body**: 调用点构造的 `{phone_num, pwd}`（`pwd`/`phone_num` 经 `Oc()` = RSA 公钥加密，见下） | 高 |
| `/account/login_code/` | index-CnBGc0ax.js | `const RIe="/account/login_code/";function IIe(e,t,n){return En.$post(RIe,e,t,n)}`；调用 `VIe({code:O.code},{phone_num:Oc(V)}, ...)` | **query**: `code`；**body**: `phone_num`（RSA 加密） | 高 |
| `/account/get_login_code/` | index-CnBGc0ax.js | `const EIe="/account/get_login_code/";function kIe(e,t,n){return En.$post(EIe,e,t,n)}`；`HIe(e,t={}){return (await kIe({},e,Bl(t))).data}` | **query**: `{}`；**body**: 调用点传入对象（未观察到实参字段名） | 中 |
| `/account/google_2fa_verify/` | index-CnBGc0ax.js | `const xIe="/account/google_2fa_verify/";function CIe(e,t){return En.$get(xIe,e,t)}`；`WIe({user_id:O.userId,code:O.code}, ...)` | **query**: `user_id`, `code` | 高 |
| `/account/wechat/state/` | index-CnBGc0ax.js | `const NIe="/account/wechat/state/";function LIe(e,t){return En.$get(NIe,e,t)}`；`jIe({}, ...)` | **query**: `{}` | 中 |
| `/account/wechat/login/v2/web_sso/` | index-CnBGc0ax.js | `const a6e="https://api.xiaoheihe.cn/account/wechat/login/v2/web_sso/"`（完整 URL 字面量，用于微信 SSO 跳转） | 由跳转 URL 携带，未在 JS 内构造参数 | 中 |
| `/account/steam_login` | index-uPk01zBZ.js | `n=new URLSearchParams({key:t});return "".concat(o,"/account/steam_login?").concat(n.toString())`（`o` = `acc` host 的 debug/production） | **query**: `key`（`steam_bind_key`，来自路由 query） | 中 |
| `/account/data_report_web/` | index-CnBGc0ax.js | `method:"POST",path:"/account/data_report_web/",name:"hb-trace.data-report"` | 埋点上报（`hb-trace.data-report`） | 中 |
| `/account/follow_game/` `/account/unfollow_game/` | index-CnBGc0ax.js | `const NU="/account/follow_game/";function i4e(e,t,n){return En.$post(NU,e,t,n)}` | **query**/**body**: 未找到调用点实参 | 中 |
| `/account/privacy_introduce/` | index-CnBGc0ax.js | 主机字面量 `https://api.xiaoheihe.cn/account/privacy_introduce/` | 未找到请求构造函数 | 低 |
| `/bbs/app/api/user/permission` | index-CnBGc0ax.js | `const $Ie="/bbs/app/api/user/permission";function BIe(e,t){return En.$get($Ie,e,t)}`；`KIe(e,t={}){return (await BIe(e,Bl(t))).data}` | **query**: 由调用点传入（未找到实参） | 中 |

RSA 加密（`/account/login/`、`/account/login_code/` 的 `phone_num`/`pwd`）：

```js
function Oc(e){ let t=new Ehe; t.setPublicKey("-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDZgjVwAiKTjZ55nG+mW6r3TSU4\n...<redacted 公钥正文>...\n-----END PUBLIC KEY-----"); ... }
```

> 该公钥是 `jsencrypt` 的 **public key**（非凭据），此处仅标注其存在；`Ehe` = `JSEncrypt`（页面由 `official_home.html` 单独从
> `https://static.max-c.com/web/npm/jsencrypt@3.3.2.hb1/jsencrypt.min.js` 加载）。

### 6.5 用户主页 / 关注 / 收藏 / 互动

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/app/profile/user/profile` | index-uPk01zBZ.js | `const Xe="/bbs/app/profile/user/profile";function We(t,r){return Y.$get(Xe,t,r)}`；`await We({userid:_.value})` | **query**: `userid`；响应 `result.account_detail` | 高 |
| `/bbs/app/profile/user/link/list_v2` | index-uPk01zBZ.js | `const tt="/bbs/app/profile/user/link/list_v2";function st(t,r){return Y.$get(tt,t,r)}`；`await st({list_type:"article",offset:s*30,limit:30,userid:n.value,dw:r.dw})` | **query**: `list_type`(`"article"`), `offset`, `limit`(30), `userid`, `dw`；响应 `result.total_page` | 高 |
| `/bbs/app/profile/events` | index-uPk01zBZ.js | `const Ze="/bbs/app/profile/events";function et(t,r){return Y.$get(Ze,t,r)}`；`await et({list_type:"moment",userid:n.value,dw:r.dw,lastval:s})` | **query**: `list_type`(`"moment"`), `userid`, `dw`, `lastval`(游标，首页 `""`)；响应 `result.moments[]`、`result.lastval` | 高 |
| `/bbs/app/profile/user/link/list` | index-CnBGc0ax.js | 仅出现在验证码 appid 白名单数组 | 未观察到调用 | 低 |
| `/bbs/app/profile/user/link/list/v2` | index-CnBGc0ax.js | 同上（注意：**有** `/bbs/app/profile/user/link/list_v2` 与 `/list/v2` 两种写法，只有前者被实际调用） | 未观察到调用 | 低 |
| `/bbs/app/profile/follow/user` | index-D4D-5XGi.js | `const r="/bbs/app/profile/follow/user";function i(e,o,s){return t.$post(r,e,o,s)}`；调用点 `(g?_n:dn)({},{link_id:String(d.value.linkid),following_id:String(d.value.userid)})` | **query**: `{}`；**body**: `link_id`, `following_id` | 高 |
| `/bbs/app/profile/follow/user/cancel` | index-D4D-5XGi.js | `const l="/bbs/app/profile/follow/user/cancel";function c(e,o,s){return t.$post(l,e,o,s)}` | **query**: `{}`；**body**: `link_id`, `following_id` | 高 |
| `/bbs/app/profile/follower/list` | index-DCMl5r75.js | `const s="/bbs/app/profile/follower/list";function r(o,t){return e.$get(s,o,t)}`（`export{p as a, r as g}`） | 未找到调用点实参 | 中 |
| `/bbs/app/profile/following/list` | index-DCMl5r75.js | `const i="/bbs/app/profile/following/list";function p(o,t){return e.$get(i,o,t)}` | 未找到调用点实参 | 中 |
| `/bbs/app/profile/fav/folders` | index-CH1Fl4gq.js | `await Ee.$get("/bbs/app/profile/fav/folders",{},{target:"heybox_app"})` | **query**: `{}`；响应 `result.folders[]` | 高 |
| `/bbs/app/profile/fav/folder/add` | index-CH1Fl4gq.js | `await Ee.$post("/bbs/app/profile/fav/folder/add",{},{name:m},{target:"heybox_app"})` | **query**: `{}`；**body**: `name`；响应 `result.folder.id` | 高 |
| `/bbs/app/profile/fav/folder/v2/links` | index-DrYQKgAZ.js | `const S="/bbs/app/profile/fav/folder/v2/links";function T(m,c){return C.$get(S,m,c)}`；`await T({enable_new_style_collect:1,dw:Math.max(s-24,0),offset:d.value,limit:F/*30*/})` | **query**: `enable_new_style_collect`, `dw`, `offset`, `limit`；响应 `result.links[]`、`result.has_next`(`"1"`/`"0"`) | 高 |
| `/bbs/app/link/favour` | safe-route-BUtxpI_Y.js（`Ge as b`） | `const ue="/bbs/app/link/favour";function Ge(e,o,t){return v.$post(ce,e,o,A(t))}`；`await sn({},{favour_type:g?2:1,link_id:String(d.value.linkid),userid:o.value?.heybox_id,folder_id:i&&i.toString()})` | **query**: `{}`；**body**: `favour_type`(1=收藏,2=取消), `link_id`, `userid`, `folder_id` ⚠️ 字段名是 **`folder_id`**，不是 `fav_folder_id` | 高 |
| `/bbs/app/profile/award/link` | safe-route-BUtxpI_Y.js（`ze as d`） | `const le="/bbs/app/profile/award/link";function ze(e,o,t){return v.$post(ie,e,o,A(t))}`；`await on({},{link_id:String(...),award_type:g?0:1})` | **query**: `{}`；**body**: `link_id`, `award_type`(1=投, 0=取消) | 高 |
| `/bbs/app/profile/build/relation` | safe-route-BUtxpI_Y.js | `const Pe="/bbs/app/profile/build/relation";function Be(e,o,t){return v.$post(ge,e,o,A(t))}`；`await Be({},{relation_type:-1,userid:String(c.value.userid)})` | **query**: `{}`；**body**: `relation_type`(-1=拉黑), `userid` | 高 |
| `/bbs/app/profile/history/visit` | index-Bh65OlLe.js | `const oe="/bbs/app/profile/history/visit";function ie(s,r){return G.$get(oe,s,r)}`；`await ie({dw:Math.max(e-24,0),type:l.value,offset:h.value,limit:M})` | **query**: `dw`, `type`, `offset`, `limit`；响应 `result.history_visit[]` | 高 |
| `/bbs/app/profile/post/limits` | index-D_mYS5_Z.js | `const or="/bbs/app/profile/post/limits";function ir(e,r){return Ue.$get(or,e,r)}`；`await ir({})` | **query**: 无 | 高 |
| `/bbs/app/api/article/get_award_users` | index-CnBGc0ax.js | `const RU="/bbs/app/api/article/get_award_users";function AAe(e,t){return En.$get(RU,e,t)}`；`await s({award_ids:o.join(",")})` | **query**: `award_ids`（逗号拼接） | 高 |

### 6.6 消息 / 通知

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/notify/official_msg_v2/list` | index-OUnWJop-.js | `const K="/bbs/notify/official_msg_v2/list";function Q(s,t){return T.$get(K,s,t)}`；`await Q({offset:i.value,limit:H,lastval:d.value,...o?{sub_entry:o}:{}})` | **query**: `offset`, `limit`, `lastval`, 可选 `sub_entry`；响应 `result.messages[]`、`result.entry_info` | 高 |
| `/bbs/app/user/message` | index-hF1eik81.js | `const r="/bbs/app/user/message";function p(s,e){return t.$get(r,s,e)}`（`export{p as g}`） | 未找到调用点实参 | 中 |
| `/bbs/app/user/discount_message_v2` | index-LS7cg0Sk.js | `const P="/bbs/app/user/discount_message_v2";function R(v,_){return M.$get(P,v,_)}` | 未找到调用点实参 | 中 |
| `/chat/stranger_messages/` | index-B3XaDXnl.js | `const L="/chat/stranger_messages/";function S(c,r){return v.$get(L,c,r)}`；`await S({offset:m.value,limit:d/*20*/})` | **query**: `offset`, `limit` | 高 |
| `/chatroom/v2/msg/user` | index-CIa40ZcO.js | `const oe="/chatroom/v2/msg/user";function ne(H,l){return D.$get(oe,H,l)}`（`q=30` 一页） | 未找到调用点实参 | 中 |
| `/chatroom/v2/common/tab` | index-KOazXBcf.js | `const Se="/chatroom/v2/common/tab";function Ve(c,p){return ne.$get(Se,c,p)}` | 未找到调用点实参 | 中 |
| `/chatroom/v2/room/card_info` | index-CnBGc0ax.js | `const OU="/chatroom/v2/room/card_info";function LAe(e,t){return En.$get(OU,e,t)}`；`await s({invite_codes:o.join(",")})` | **query**: `invite_codes`（逗号拼接） | 高 |
| `/chatroom/mobile/report` | index-CH1Fl4gq.js | `const ko="/chatroom/mobile/report";function yo(e,s,o){return Ee.$post(ko,e,s,o)}` | **POST**，实参未观察到 | 中 |
| `/chatroom/mobile/search/joined_rooms` | menu-vote…-ClamgeT8.js | 路径字面量 | 未找到请求构造函数 | 低 |

### 6.7 发帖 / 上传 / 草稿

| 路径 | 来源文件 | 证据片段(短) | 推断的请求参数 | 置信度 |
|---|---|---|---|---|
| `/bbs/app/api/link/post` | index-D_mYS5_Z.js | `const fr="/bbs/app/api/link/post";function dr(e,r,a){return Ue.$post(fr,e,r,a)}`；`(e.type==="video"?br:dr)({},{...pe,...ie,...(ue?{topic_ids:ue}:{}),link_tag:Kt(e.type,ue)})` | **query**: `{}`；**body**: 见下 | 高 |
| `/bbs/app/api/video-link/post` | index-D_mYS5_Z.js | `const yr="/bbs/app/api/video-link/post";function br(e,r,a){return Ue.$post(yr,e,r,a)}` | 同上（视频贴走这个） | 高 |
| `/bbs/app/link/edit/info` | index-D_mYS5_Z.js | `const vr="/bbs/app/link/edit/info";function pr(e,r){return Ue.$get(vr,e,r)}` | 未找到调用点实参 | 中 |
| `/bbs/app/link/drafts` | index-BU5x5NvF.js | `const W="/bbs/app/link/drafts";function tt(l,i){return T.$get(W,l,i)}`；`await tt({offset:t,limit:h/*40*/,no_more:!1})` | **query**: `offset`, `limit`, `no_more`(布尔 `false`)；响应 `result.links[]`、`result.total_page` | 高 |
| `/bbs/app/link/change/status` | index-BU5x5NvF.js | `const et="/bbs/app/link/change/status";function at(l,i){return T.$get(et,l,i)}` | 未找到调用点实参 | 中 |
| `/bbs/app/link/delete` | index-DuaVHxeJ.js | `const o="/bbs/app/link/delete";function i(e,t,p){return s.$post(o,e,t,p)}` | 未找到调用点实参 | 中 |
| `/bbs/app/link/vote` | index-BCw2n2PS.js | `const te="/bbs/app/link/vote";function me(g,$,b){return ne.$post(te,g,$,{...b,target:"auto"})}` | 未找到调用点实参；另有 `need_encrypt:0` 变体 | 中 |
| `/bbs/app/api/qcloud/cos/upload/token/v2` | UploadItem-CjDFnmgd.js | `var T=V+"/bbs/app/api/qcloud/cos/upload/token/v2";return vt.$post(T,fe,Q,yt(P))` | **POST**；响应 `result.credentials.{tmpSecretId,tmpSecretKey,sessionToken}` | 中 |
| `/bbs/app/api/qcloud/cos/upload/info/v2` | UploadItem-CjDFnmgd.js | `var T=V+"/bbs/app/api/qcloud/cos/upload/info/v2";return vt.$post(T,fe,Q,yt(P))` | **POST** | 中 |
| `/bbs/app/api/qcloud/cos/upload/callback/v2` | UploadItem-CjDFnmgd.js | `var T=V+"/bbs/app/api/qcloud/cos/upload/callback/v2"` | **POST** | 中 |
| `/bbs/app/api/qcloud/cos/upload/heartbeat` | UploadItem-CjDFnmgd.js | `var T=V+"/bbs/app/api/qcloud/cos/upload/heartbeat"` | **POST** | 中 |
| `/bbs/app/api/qcloud/cos/copy/image/by/url` | cpt-editor-publish…-DFMhpHCR.js | `const Nd="/bbs/app/api/qcloud/cos/copy/image/by/url";function Rd(n,t){return ji.$get(Nd,n,t)}` | **GET** | 中 |
| `/bbs/app/api/original/image` | index-DqPpWXns.js | `const ot="/bbs/app/api/original/image";function st(e,t){return He.$get(ot,e,t)}` | **GET** | 中 |
| `/bbs/app/api/emojis/list` | index.vue…-CczlcyPk.js | `const tc="/bbs/app/api/emojis/list";function nc(o,e){return zi.$get(tc,o,e)}`；`await nc({})` | **query**: 无；响应 `result.emoji_groups` | 高 |
| `/bbs/app/api/web/share` | index-QyGRQrYB.js | 路径字面量（另有完整 URL `https://api.xiaoheihe.cn/v3/bbs/app/api/web/share` 出现在主 bundle） | 未找到请求构造函数 | 低 |

`/bbs/app/api/link/post` 的 body（index-D_mYS5_Z.js，节选，**仅分析，勿发送**）：

```js
const j = { ...v, linkid:m, link_id:m, userid: ne || Number(v.userid) || 0,
            title: h.title || "标题", text: h.text || "请输入内容",
            description: h.desc || "", desc: h.desc || "",
            link_tag: s.linkTag.value,
            has_video: e.type==="video"?1:0, is_article: e.type==="article"?1:0,
            use_concept_type: e.type==="image_text"?1:0,
            is_web: v.is_web ?? 1, thumb: ..., up: ..., can_edit: ...,
            is_hot_post: ..., multidimensional_score: ..., is_award_link: ..., is_favour: ... };
// 最终：
const pe = { ...(k?{draft:1}:{}), ...(W?{edit:1}:{}) };
ve = await (e.type==="video" ? br : dr)({},
        { ...pe, ...ie, ...(ue ? {topic_ids:ue} : {}), link_tag: Kt(e.type,ue) });
```

`topic_ids` 生成：`getPostParams: async () => ({ topic_ids: d.value.map(f=>f.topic_id).join(",") })` —— **逗号拼字符串**。

`link_tag` 取值表（源码常量，同文件）：

```js
it = { 视频贴:1, 新动态分区:28, 图文:27, 文章:11 }
function Kt(e,r){ return e==="video" ? it.视频贴
                       : e==="image_text" ? (r==="58144" ? it.新动态分区 : it.图文)
                       : (r==="58144" ? 21 : it.文章); }
```

### 6.8 页面里同时出现的其他接口（非本次重点，列出以免遗漏）

`/game/get_game_infos/`、`/game/get_game_detail/`、`/game/console/get_game_detail/`、`/game/mobile/get_game_detail/`、`/game/game_introduction/`、
`/game/owned_game/game_list`、`/game/owned_game/hot_list`、`/game/steam/screenshot/list`、`/game/match/leagues`、`/game/match/batch_match_data`、
`/game/match/watch_match`、`/game/match/unwatch_match`、`/game/self_made_game_list/data/infos`、`/game/self_made_game_list/favour`、
`/game/wx_share/info/v2`、`/game/item/show`、`/heyboxpc/client/get_download_url`、`/heyboxpc/v2/client/release/download/v1|v2`、
`/heyboxpc/v2/client/channel_download_page/v1`、`/heyboxpc/v2/client/release/download/redirect/v2`、`/heyboxpc/v2/website_background/v1`、
`/heyboxpc/v2/report/web`、`/mall/search/`、`/mall/sku/detail/`、`/mall/sku/show`、`/wiki/get_wiki_infos`、`/wiki/search`、`/wiki/search_wiki/`、
`/workshop/app/mod_detail`、`/workshop/open/mod_search`、`/tools/mod_manager/mod_detail`、`/oa/match/*`、`/steam/addwishlist/click_protocol`、
`/pubg/report`、`/api/subscribe/appoint`、`/creator/content_management/home`、`/creator/draft`、`/creator/editor`、`/open/commodity`、
`/open/commodity/productunit`、`/open/qualification`、`/open/modify_qualification_info`、`/rc/box_data/callback`、`/bbs/web/feedback/*`、
`/bbs/app/feedback/close`、`/bbs/app/feedback/faq/detail/page`、`/bbs/app/author/concept/article/list`、`/bbs/app/author/concept/article/data`、
`/bbs/content_marketing/post/task_list`、`/bbs/content_marketing/author/link/post`、`/bbs/app/render/debug/info`。

---

## 关键问题发现

### 1) 社区 / 分区目录 & 社区详情（topic list / topic detail / topic categories / 分区）

- **源码中存在**（目录）：
  - `/bbs/app/topic/categories` —— 无参 GET。调用点：`await lt({},{signal:c})`，
    响应 `result.latest_hot_topics.children`，页面组件把它当“热门社区”只取前 5 个
    （`h=b(()=>{ ... a.data.value?.latest_hot_topics?.children?.slice(0,5) ?? [] })`）。
  - `/bbs/app/feeds/banner` —— 无参 GET，返回 `result.topic_banner.top_topics`（页面 `slice(1)` 去掉第一个）
    与 `result.topic_banner.subscribed_topics`；首页顶部那一排“社区/分区”图标就是这两段拼起来的：
    `H=b(()=>{const e=S.data.value?.top_topics?.slice(1)??[], o=S.data.value?.subscribed_topics??[]; return [...e,...o]})`。
  - 社区条目点击后走**网页路由** `/app/topic/link/<topic_id>`（`s.push("/app/topic/link/".concat(e.topic_id))`），不是接口。
- **源码中存在**（社区详情）：`/bbs/app/topic/menu`，参数 `{topic_id, appid}`，
  调用点响应取 `B.data.value?.topic`。**这是本 Web 端唯一的“社区/分区详情”接口**。
- **源码中存在**（社区内信息流）：`/bbs/app/topic/feeds`、`/bbs/app/topic/feeds/news`（见下一条）。
- **未找到**：任何形如 `/bbs/app/topic/detail`、`/bbs/app/topic/info`、`/bbs/app/topic/category/...` 的接口；
  也没有“分区列表带分类树”的独立接口（树来自 `topic/categories` 与 `feeds/banner` 的响应结构 `children`）。

### 2) 通用信息流 `/bbs/app/feeds` 与它是否传 `topic_id`

- **源码中存在**，且**只有一个调用点**（index-TG6UTXfP.js 首页）：

  ```js
  await at({ pull: 0,
             offset: e,
             dw: ((c.value?.clientWidth) || 660) - 56 }, { signal: o })
  ```

- 结论：**`/bbs/app/feeds` 只发送 `pull` / `offset` / `dw` 三个业务参数**；
  - **从不发送 `topic_id`** —— 已在 `index-TG6UTXfP.js` 全文检索 `topic_id`，命中的 3 处全部是 UI/数据用途：
    ① 热门社区列表 `key:u.topic_id`，② 路由跳转 `s.push("/app/topic/link/".concat(e.topic_id))`，③ 社区条目 `key/onClick`。
    **没有任何一处把它放进请求参数对象。**
  - **没有“多 id”（`topic_ids`）形态** —— `topic_ids` 只出现在发帖 body（`/bbs/app/api/link/post`）里。
  - **没有 “exclude / 排除” 参数** —— 全 bundle 检索未发现 `exclude*` 形态的请求参数；
    唯一的过滤是响应侧 `filter(t=>t.content_type!==18)`（客户端本地过滤，不发给服务端）。
  - `pull: 0` 是唯一像“模式开关”的字段（字面量恒为 0，没有第二个取值出现在本 bundle 里）。
- 置信度：高（路径 + 请求构造函数 + 唯一调用点实参都在）。

### 3) 单社区信息流 `/bbs/app/topic/feeds` 的排序 / 分页参数

- **源码中存在**。参数对象（唯一调用点，index-CttNF2ng.js）：

  ```js
  { topic_id, offset, limit, lastval, sort_filter: f.value || void 0,
    dw: ((E.value?.clientWidth) || 660) - 56, ...(menuItem?.params ?? {}) }
  ```

- 分页：`initialPageParam = {offset:0, limit:10, lastval:""}`；
  `getNextPageParam = (prev,_,cur) => (prev?.links ?? []).length !== 0
        ? {offset: cur.offset + cur.limit, limit: 30, lastval: prev?.lastval ?? ""} : undefined`。
  → 首屏 `limit=10`，之后每页 `limit=30`；**游标字段是 `lastval`**（`last_val` 形状只在 `menu-at…Da8RBsx5.js` 里出现过 1 次，属其他逻辑）。
- 排序：字段名 **`sort_filter`**；值来自当前菜单项（`f` = 路由/菜单 state 里的 sort），
  且菜单项还可通过 `...menuItem.params` 追加参数（即 `topic/menu` 返回的菜单项自带 `params`）。
- 同一函数按 `menuItem.type === "link"` 在 `/bbs/app/topic/feeds`（`gt`）与 `/bbs/app/topic/feeds/news`（`yt`）之间切换。
- 置信度：高。

### 4) 帖子详情 `/bbs/app/link/tree`（含评论分页）

- **源码中存在**（Extension-8SRztW9Y.js `Nn` → 被 index-CH1Fl4gq.js 以 `mn` 导入）：

  ```js
  { link_id: De(e), is_first: i===1?1:0, page: i, index: 1, limit: 20, owner_only: 0 }
  // 条件追加：
  u.value && (x.root_comment_id = u.value);
  r.value && (x.comment_id      = r.value);
  // 分页：initialPageParam:1 ; getNextPageParam:(i,g,x)=>{ if(i?.has_more_floors) return x+1 }
  ```

- 结论：
  - 分页参数是 **`page`（从 1 开始）+ `index`（恒 1）+ `limit`（20）**；
  - **`is_first`**：`page===1 ? 1 : 0`；
  - **`owner_only`**：字面量恒 `0`（本 bundle 未出现其他取值）；
  - 翻页依据是响应字段 **`has_more_floors`**；
  - `root_comment_id` / `comment_id` 用于“定位/展开某楼层或某条子评论”。
- **`/bbs/app/link/tree/v2` 与 `/bbs/app/link/tree/backend`：未观察到网页调用**。
  这两个字面量在整个 80 个文件中**只**出现在主 bundle 的一个验证码 appid 白名单数组里：

  ```js
  function zpe(e){ return ["/bbs/app/api/general/search/v1","/bbs/app/api/general/search/v1/web",
    "/bbs/app/link/tree/v2","/bbs/app/link/tree","/bbs/app/link/tree/backend",
    "/bbs/app/profile/user/link/list","/bbs/app/profile/user/link/list/v2","/bbs/app/profile/events"]
    .some(t=>e.includes(t)) ? "199251710" : "2061805035" }
  ```

  → **不能据此认为网页会调用 `/v2` 或 `/backend`**（它们只被用作“命中该路径就用腾讯验证码 appid 199251710”的匹配串）。
- 置信度：高（`/bbs/app/link/tree`）；低/未观察（`/v2`、`/backend`）。

### 5) 评论子回复

- **源码中存在**：`/bbs/app/comment/sub/comments`（index-CH1Fl4gq.js `En`）：

  ```js
  const {data:{status:x,msg:M,result:R}} = await En({
      root_comment_id: i,
      lastval: g?.comment?.at(-1)?.commentid || ""   // 末条子评论的 commentid
  });
  // 响应：result.comments[]、result.has_more（写回 has_more = R?.has_more ? 1 : 0）
  ```

- 即：**子回复分页用 `lastval` + `root_comment_id`**，游标值是**最后一条子评论的 `commentid`**。
- 相关的评论写操作也都在源码里：
  - 发评论 `/bbs/app/comment/create`：body `{is_cy, link_id, reply_id, root_id, text, imgs?}`，`root_id/reply_id` 用 `"-1"` 表示“无”，
    **config 带 `{rnd:"15"}`**（触发 HMAC 签名，见“签名与公共参数”）。
  - 顶/踩 `/bbs/app/comment/support`：body `{comment_id, support_type}`（1=有用，2=取消/踩）。
- 置信度：高。

### 6) 搜索（通用搜索 + 社区/话题搜索）

- **源码中存在**（通用搜索）：`/bbs/app/api/general/search/v1`（index-CILLi-Eo.js，导出别名 `g`）。
  Web 搜索页（index-Sbe-3Z-0.js）实参：

  ```js
  { q, search_type, game_type?(仅 search_type==="game"), time_range?(仅 "link"),
    filter_tag, is_pull_down: 0, offset, limit: 30, dw: (clientWidth||660)-32 }
  ```

  tab 常量：`general(综合) / link(内容) / game(游戏) / mini_program(小程序) / user(用户) / hashtag(话题) / mall(商品)`。
- **源码中存在**（话题/社区搜索）：`/bbs/app/api/post_editor/topic_selection/search`，实参 `{q, only_hashtag: 0}`；
  响应 `result.search_result[]`，元素带 `search_type`，网页用 `.filter(y=>y.search_type==="topic")` 与 `==="hashtag"` 分别取“社区”和“话题”。
  → **这就是“社区/话题搜索”的实际入口**。
- **源码中存在**（搜索联想/热搜）：`/bbs/app/api/search/suggestion/v2`(`{q}`)、
  `/bbs/app/api/search/welcome_page/v2`(`{}`)、`/bbs/app/api/search/found`(`{force_refresh}`)。
- **源码中存在**（@ 提及搜索）：`/bbs/app/api/at/search`(`{q}`)。
- **未找到**：独立的“社区搜索接口”（如 `/bbs/app/topic/search`）；也**未观察到调用** `/bbs/app/api/general/search/v1/web`
  （该字面量只出现在验证码 appid 白名单数组）。
- 置信度：高（前四项）；`/general/search/v1/web` 低。

### 7) 扫码登录 / 登录态检查

- **源码中存在**：
  - `/account/get_qrcode_url/` —— **GET**，实参 `{app:"web"}`，响应 `result.qr_url`、`result.expire`。
  - `/account/qr_state/` —— **GET**，实参 `{qr: <从 qr_url 的 querystring 解析出的 qr>, app:"web"}`，在 `for(;;)` 轮询循环里调用；
    响应的 `status` 可能为 `"need_google_check"`，`result.error` 可能为 `"wait"`。
  - **登录态检查 = `/account/restore_login`（GET，参数 `{}`）**：调用点读取 `result.account_detail.userid` 并写回 `heybox_id` cookie，
    react-query 的 `queryKey` 就是 `["user"]`，`staleTime:1/0`；未登录返回空则视为未登录。
  - 退出：`/account/logout`（GET，`{}`），随后清 `heybox_id` cookie。
  - 账号密码登录：`/account/login/`（POST，query `{}`，body 含 RSA 加密后的 `phone_num`/`pwd`）；
    短信验证码登录：`/account/login_code/`（POST，query `{code}`，body `{phone_num}`）；
    获取验证码：`/account/get_login_code/`（POST，query `{}`，body 未观察到字段名）；
    两步验证：`/account/google_2fa_verify/`（GET，`{user_id, code}`）。
  - 微信：`/account/wechat/state/`（GET）、完整 URL `https://api.xiaoheihe.cn/account/wechat/login/v2/web_sso/`。
  - Steam：`{accHost}/account/steam_login?key=<steam_bind_key>`（由 `URLSearchParams` 构造后跳转）。
- 所有账号类请求的 config 都带 `forbidden_auto_tologin:true`（`function Bl(e={}){return{...e,forbidden_auto_tologin:!0}}`）。
- 置信度：高（QR / restore_login / logout / login）；中（wechat/steam/get_login_code）。

### 8) 用户主页 / 关注 / 收藏 / 互动消息

- **源码中存在**：
  - 用户信息 `/bbs/app/profile/user/profile` GET `{userid}` → `result.account_detail`；
  - 用户帖子 `/bbs/app/profile/user/link/list_v2` GET `{list_type:"article", offset:page*30, limit:30, userid, dw}` → `result.total_page`；
  - 用户动态 `/bbs/app/profile/events` GET `{list_type:"moment", userid, dw, lastval}` → `result.moments[]`、`result.lastval`；
  - 关注/取关 `/bbs/app/profile/follow/user` 与 `/bbs/app/profile/follow/user/cancel` POST body `{link_id, following_id}`；
  - 拉黑 `/bbs/app/profile/build/relation` POST body `{relation_type:-1, userid}`；
  - 收藏夹列表 `/bbs/app/profile/fav/folders` GET `{}`；新建 `/bbs/app/profile/fav/folder/add` POST body `{name}`；
    收藏内容 `/bbs/app/profile/fav/folder/v2/links` GET `{enable_new_style_collect:1, dw, offset, limit}` → `result.links[]`、`result.has_next`；
  - 收藏/取消收藏帖子 `/bbs/app/link/favour` POST body `{favour_type:1|2, link_id, userid, folder_id}`；
  - 打赏/取消 `/bbs/app/profile/award/link` POST body `{link_id, award_type:1|0}`；
  - 浏览历史 `/bbs/app/profile/history/visit` GET `{dw, type, offset, limit}` → `result.history_visit[]`；
  - 互动/官方消息 `/bbs/notify/official_msg_v2/list` GET `{offset, limit, lastval, sub_entry?}` → `result.messages[]`、`result.entry_info`；
    私信陌生人 `/chat/stranger_messages/` GET `{offset, limit}`；聊天室 `/chatroom/v2/msg/user`、`/chatroom/v2/common/tab`、`/chatroom/v2/room/card_info`。
- 关注者/粉丝列表 `/bbs/app/profile/follower/list`、`/bbs/app/profile/following/list`：**源码中存在**（请求构造函数已找到），
  但**未找到带实参的调用点**，因此参数名**未确定**（很可能含 `userid`/`offset`/`limit`，但这是推测，不写入结论）。
- 置信度：多为高；`follower/following list`、`/bbs/app/user/message`、`/bbs/app/user/discount_message_v2` 为中（参数未知）。

### 9) 发帖 / 评论创建的参数名（仅静态分析，**从未发送**）

- 发帖：`POST /bbs/app/api/link/post`（图文/文章）或 `POST /bbs/app/api/video-link/post`（视频）。
  - query：`{}`（第二个实参是空对象）。
  - body 字段（源码中实际拼出的）：`link_id`/`linkid`、`userid`、`title`、`text`、`description`、`desc`、
    `link_tag`、`has_video`、`is_article`、`use_concept_type`、`is_web`、`thumb`、`up`、`can_edit`、
    `is_hot_post`、`multidimensional_score`、`is_award_link`、`is_favour`、`topic_ids`（逗号拼接字符串）、
    可选 `draft:1`、可选 `edit:1`、可选 `api_status`、可选 `view_limit`。
  - `link_tag` 常量：视频贴=1、新动态分区=28、图文=27、文章=11（topicId `"58144"` 时文章用 21）。
- 发评论：`POST /bbs/app/comment/create`，query `{}`，body `{is_cy, link_id, reply_id, root_id, text}`（图片时追加 `imgs`，`;` 分隔），
  config `{rnd:"15"}`。
- 帖子投票：`POST /bbs/app/link/vote`（两个变体：`{target:"auto"}` 与 `{need_encrypt:0}`），**实参未观察到**。
- 置信度：高（帖子/评论创建字段来自实际调用的对象字面量）；中（`link/vote`）。

### 10) 其他值得记录的源码事实

- **接口域名选择表**（主 bundle，`Pk`）：

  ```js
  const Pk = {
    heybox_app:      { dev:"https://heybox.debugmode.cn", prod:"https://api.xiaoheihe.cn",   devPrefix:"/dev_api_heybox" },
    maxjia_app:      { dev:"https://v5max.debugmode.cn",   prod:"https://v5api.maxjia.com",   devPrefix:"/dev_api_maxjia" },
    heybox_chat:     { dev:"https://chat.xiaoheihe.cn",    prod:"https://chat.xiaoheihe.cn",  devPrefix:"/dev_api_chat" },
    heybox_workshop: { dev:"https://heybox.debugmode.cn",  prod:"https://workshopapi.xiaoheihe.cn", devPrefix:"/dev_api_workshop" },
    heybox_oa:       { dev:"https://heybox.debugmode.cn",  prod:"https://heyboxoa.maxjia.com", devPrefix:"/dev_api_heybox_oa" },
    heybox_egg:      { dev:"https://web.debugmode.cn",     prod:"https://web.xiaoheihe.cn",   devPrefix:"/dev_api_egg" },
    heybox_acc:      { dev:"https://heybox.debugmode.cn",  prod:"https://accapi.xiaoheihe.cn", devPrefix:"/dev_api_acc" }
  };
  ```

  目标选择：`target` 默认 `"auto"` → `getRequestAutoTarget()`；该函数在**非 Heybox 容器内 fallback 为 `"heybox_app"`**
  （`Pl({...}, ()=>"heybox_app")`），因此**纯浏览器环境下 baseURL = `https://api.xiaoheihe.cn`**。
- **常量字符串外泄检查**：`zpe()` 里的两段路径命中列表说明服务端会对这些接口触发图形验证码（腾讯 TCaptcha，
  脚本 `https://turing.captcha.qcloud.com/TCaptcha.js`），appid 分别为 `199251710`（命中 bbs 敏感接口）与 `2061805035`（默认）。

---

## 签名与公共参数

### A. 每个请求都会带的公共参数（两条链路）

请求拦截器把公共参数**合并**进 `params`：

```js
async function _Ee(e){ return e.params = { ...(await bEe(e)), ...Wwe(Gk(e.url)), ...e.params }, e }
function aU(e,t){ return t?.params ? {...e||{}, ...t.params} : e }   // config.params 再覆盖一次
```

1. **平台参数** `bEe(e)` = `await e.getPlatformRequestParams?.()`；Web 端该函数由启动插件显式注入（主 bundle 末尾）：

   ```js
   En.defaults.getPlatformRequestParams = async () => ({
     ...await Iq(),                       // 运行时探测；website → kq()
     heybox_id: fd("heybox_id"),          // 读 cookie
     x_app: "heybox_website",
     x_client_type: "web",
     client_type: "web",
     web_version: V4("web_version")       // 读 <meta name="web_version" content="3.0"> → "3.0"
   });
   ```

   其中 `kq()`（website 运行时）为：

   ```js
   { app:"heybox", heybox_id: fd("heybox_id"), os_type:"web", x_app:"heybox_website",
     x_client_type:"weboutapp",                    // 被上面的 "web" 覆盖
     x_os_type: Mi(),                              // UA 嗅探: "ohos"|"Android"|"iOS"|"Mac"|"Windows"
     web_version: V4("web_version"),
     device_id: await Mpe() }                      // fingerprintjs visitorId
   ```

   → **实际发出的公共参数**（并集，后者覆盖前者）：
   `app=heybox, heybox_id=<cookie>, os_type=web, x_app=heybox_website, x_client_type=web, client_type=web,
   x_os_type=<Mac|Windows|Android|iOS|ohos>, web_version=<meta: 3.0>, device_id=<fingerprint visitorId>`。

   ⚠️ 注意：
   - **没有 `device_info` 作为全局参数** —— 全 bundle 只有 1 处 `device_info:`，是
     `/bbs/app/link/related/recommend_web` 的显式实参（值 `"Chrome"`）。
   - **没有 `_notip`** —— 全 bundle 检索 `_notip` 命中 0 次。
   - `x_client_version` 只出现在 **heybox 容器 / maxjia / PC 客户端**分支（`x_client_version: Bo("version")`，从 URL query 读），
     **Web 分支不带**。

2. **签名参数** `Wwe(path)` —— 见下节，产出 `version`、`hkey`、`_time`、`nonce` 四个参数
   （其中 `version` 恒为 `"999.0.4"`，与 HTML 里的 `web_version=3.0` 是两个不同字段）。

关键点：`Gk(e.url)` 用正则 `^(?:https?:\/\/[^\/?#]+)?(\/[^?#]*)` **只取 path，丢掉 query string**，
所以 hkey 是对**路径**（不含 query）计算的。

### B. `hkey` / `nonce` / `_time` 生成（**这是本报告最硬的证据**）

参数名被字符串数组混淆，先还原：

```js
const Ss = ["a","b","e","g","h","i","m","n","o","p","q","r","s","t","u","w"];

function Wwe(e){                                  // e = 请求路径（不含 query）
  let t, n, r, o = FM(), a = Ss[3];               // a = "g"
  t = ~~(+zM.w() / 1e3);                          // _time = Date.now()/1000 取整（秒）
  r = so.MD5(t + new Date().getTime() + Math.random().toString() + FM() + o)
        .toString().toLocaleUpperCase();          // nonce = 32 位大写 MD5 十六进制
  n = zM[a](e, t, r);                             // = Tr(path, t + 1, nonce)  → hkey
  return {
    version: "999.0.4",
    ["".concat(Ss[4],"k").concat(Ss[2],"y")]: n,                        // 还原 = "hkey"
    ["_".concat(Ss[13]).concat(Ss[5]).concat(Ss[6]).concat(Ss[2])]: t,  // 还原 = "_time"
    ["".concat(Ss[7]).concat(Ss[8]).concat(Ss[7],"c").concat(Ss[2])]: r // 还原 = "nonce"
  };
}
```

- 字符串数组 `Ss` 就是 `["a","b","e","g","h","i","m","n","o","p","q","r","s","t","u","w"]`，
  用下标拼出 `"hkey"` / `"_time"` / `"nonce"`（所以**直接 grep `hkey` 会 0 命中**，必须按数组还原）。
- `so` = 打包进来的 **crypto-js**（同文件另有 `so.AES.encrypt`、`so.enc.Utf8.parse`）；
  `so.MD5(x).toString()` 是**小写**十六进制，`nonce` 再 `.toLocaleUpperCase()` 变成大写。
- `FM()` = 设备/环境指纹串：

  ```js
  function FM(){ return (typeof process<"u" && process.versions?.node!=null) ? ""
                        : ((Fwe() ?? Bwe()) + Hwe()); }
  ```

  相邻代码可见它由 **时区偏移**（`...getTimezoneOffset()`）与 **`navigator.language`** 之类的片段拼成；
  精确到字符级需要反编译那两个短函数（本次未展开，见“未解决/存疑”）。
- `zM.w()` = `new Date`；`zM.g` 的定义是 `g(e,t,n){ return Tr(e, t+1, n) }` ——
  **hkey 用的时间戳是 `_time + 1`**（比 `_time` 大一秒）。

hkey 本体 `Tr`（**7 个字符**，与假设的“7 chars”长度一致）：

```js
function Tr(e, t, n){
  e = "/" + e.split("/").filter(f=>f).join("/") + "/";      // 归一化路径：前后各加一个 "/"，去掉空段
  const C = "AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89";          // ← 唯一字符集常量，38 个字符
  const o = HM(String(t), C, -2);                           // 时间戳逐位映射到 C 的【最后 2 个字符】上
  const a = VM(e, C);                                       // 路径每个字符映射到 C 上
  const s = VM(n, C);                                       // nonce 每个字符映射到 C 上
  const i = zwe([o, a, s]).slice(0, 20);                    // 三者【交错】再取前 20 个字符
  const l = so.MD5(i).toString();                           // 32 位小写 MD5
  let u = String(qwe(Vwe(l.slice(-6).split("").map(c=>c.charCodeAt(0)))) % 100);  // 后 6 位 → 0..99
  u = u.length < 2 ? "0" + u : u;                           // 补零成 2 位
  const c = HM(l.substring(0, 5), C, -4);                   // 前 5 个字符映射到 C 的【最后 4 个字符】上 → 5 字符
  return c + u;                                             // 5 + 2 = 7 字符
}
// HM(s, C, k): 对 s 的每个字符取 charCodeAt % |C.slice(k)| 作为下标，从 C.slice(k) 里取字符（替换密码）
// VM(s, C):    同上但从整个 C 里取
// zwe(arr):    交错拼接（round-robin），保证三段的字符互相穿插
// qwe(arr):    求和；Vwe(4 字节数组): 位运算混合
```

**对原假设的判定：**

- ✅ **长度假设成立**：hkey 确实是 **7 个字符**。
- ✅ **输入假设方向成立**：hkey 确实由 **（归一化路径，时间戳，nonce）** 三者决定，路径会先被归一化成 `/a/b/c/`。
- ❌ **算法假设不成立**：它 **不是** “`MD5(nonce+path+timestamp)` 后取 7 位”。
  实际是：把（时间戳字符串、路径、nonce）分别做**字符集替换**（字符集 `AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89`），
  **交错**后截取 20 个字符，对**这 20 个字符**求 MD5；
  再从这个 MD5 十六进制里取**前 5 位**做一次替换（→5 字符）和**后 6 位**做位混合取模 100（→2 位十进制），拼成 7 字符。
  也就是说 nonce/path/timestamp **不是简单拼接**，而是先映射再交错。
- ⚠️ **时间戳用的是 `_time + 1`**（`zM.g` 加 1），不是 `_time` 本身。
- 字符集常量（要求上报的那个）：**`AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89`**。
- 另外 `Ss` 数组本身也是常量：`["a","b","e","g","h","i","m","n","o","p","q","r","s","t","u","w"]`。

### C. `_rnd`（第二套签名，只在显式要求时使用）

```js
const qM = "Z7mFG4tQp9Ws2LxB8H";

async function Uwe(e, t){                     // e = nonce, t = `${_time}:${nonce}`
  const enc = new TextEncoder(),
        msg  = enc.encode(qM + e + t),        // = qM + nonce + (_time + ":" + nonce)
        key  = enc.encode(qM),
        k    = await crypto.subtle.importKey("raw", key, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]),
        sig  = await crypto.subtle.sign("HMAC", k, msg),
        out  = new Uint8Array(sig);
  return Array.from(out).map(b => b.toString(16).padStart(2,"0")).join("");   // 64 位小写十六进制
}

async function SEe(e){
  if (e.rnd === "15") {
    const t = await Uwe(e.params.nonce, `${e.params._time}:${e.params.nonce}`);
    e.params._rnd = "15:" + t;                // 形如 "15:<64 hex>"
  }
  return e;
}
```

- **HMAC-SHA-256**，key = `"Z7mFG4tQp9Ws2LxB8H"`（19 字符），message = `qM + nonce + (_time + ":" + nonce)`；
- 输出**完整 64 位十六进制，无截断**；
- 结果放进参数 `_rnd`，前缀 `"15:"`（版本号标记）；
- 仅在请求 config 显式写 `{rnd:"15"}` 时触发。本次在源码里**只找到 1 处**这样的调用点：
  `/bbs/app/comment/create`（`await rn({}, i, {rnd:"15"})`）。
- 置信度：高（函数体 + 调用点都在同一个 bundle 里）。

### D. 请求头 / Authorization / Token

- **未发现任何自定义 `X-*` 请求头**。全 80 个文件检索 `"?X-[A-Za-z-]+"?\s*:` 的命中全部来自
  hls.js（`video.es-Dx37Ufdt.js` 的 `#EXT-X-*` 标签）与腾讯 COS SDK（`UploadItem-CjDFnmgd.js` 的 COS `Authorization`/`SecurityToken`），
  **都不是小黑盒业务请求头**。
- **未发现 `Authorization` 头被业务代码设置**。`index-CnBGc0ax.js` 里的 `Authorization` 两处都在打包进来的 axios 内部
  （`l && i.set("Authorization","Basic "+btoa(...))` 是 axios 的 proxy 认证；另一处是 axios 的方法黑名单数组），
  业务代码没有调用它。
- **未发现 `token`/`access_token` 请求头**。
- **认证靠 Cookie**：axios 实例创建处显式开启 `withCredentials`：

  ```js
  function LEe(){
    const e = $we.create({ withCredentials:!0, transformRequest:[DEe,NEe], timeout:PEe,
                           need_recall:!0, forbidden_auto_tologin:!1 });
    ...
    e.defaults.getPlatformRequestParams = Iq;
    e.defaults.getRequestAutoTarget = Yge;
    e.defaults.toAuth = Gge; e.defaults.toLogin = Kge; ...
  }
  ```

- **响应拦截器**（登录态/验证码处理）：

  ```js
  // status === "lack_token" → 调用 config.setXHHTokenIDWithSDK() 拿新 tokenid，再 need_recall 重放一次
  // status === "show_captcha" → 动态加载 TCaptcha.js，用 appid（zpe() 决定 199251710 / 2061805035）弹验证码
  ```

- **`x_xhh_tokenid` cookie：客户端会“写”，但不“读”**（源码层面）：

  ```js
  async function Nrt(e){
    if (!e) throw new Error("xhh_token_id 不能为空");
    if (typeof e !== "string") throw new TypeError("xhh_token_id 应该为string");
    var t = new Date; t.setTime(t.getTime() + 336*60*60*1e3);          // 336 小时 = 14 天
    document.cookie = "x_xhh_tokenid=" + escape(e) + ";expires=" + t.toGMTString()
                    + ";path=/;domain=" + (host.includes("xiaoheihe.cn") ? "xiaoheihe.cn" : <当前域>);
  }
  async function cF(e){
    let t = e.getDeviceId(), n = "";
    if (t.startsWith("B") && t.length===89) n = t;
    if (t.startsWith("D")) n = await Drt(t);
    if (!n) throw new Error("tokenid创建失败");
    return window.X_XHH_TOKENID = n, Nrt(n), n;                        // 同时挂到 window.X_XHH_TOKENID
  }
  ```

  - 值来自设备指纹 SDK 的 `getDeviceId()`（`B` 前缀 89 长度直接用；`D` 前缀需 `Drt()` 解出）；
  - 只写 cookie + 挂 `window.X_XHH_TOKENID`，**没有找到读 `x_xhh_tokenid` 的代码**（它靠 `withCredentials` 自动随请求发出）；
  - cookie 有效期 **336 小时（14 天）**，`path=/`，domain 为 `xiaoheihe.cn`（在 xiaoheihe.cn 域下时）；
  - 同一模块还初始化 Sentry 式 `window._smConf = {organization:"0yD85BjYvGFAvHaSQ1mc", appId:"heybox_website", publicKey:"<redacted>"}`。
- **`heybox_id` cookie 是被读的**：`fd("heybox_id")` → 进公共参数 `heybox_id`；登录成功后由 `QI("heybox_id", userid)` 写入。
- 置信度：高。

---

## 未解决 / 存疑

1. **`FM()` 的精确内容未完全还原。** 已知它是 `(Fwe() ?? Bwe()) + Hwe()`，且相邻代码含
   `getTimezoneOffset()` 与 `navigator.language`；但 `Fwe/Bwe/Hwe` 三个短函数未逐字符展开。
   因此 **nonce 的 MD5 输入串无法 100% 复现**（只知形如 `秒级时间戳 + 毫秒时间戳 + Math.random() + 指纹 + 指纹`）。
   这直接影响能否离线复现 `nonce` → `hkey`。
2. **`Vwe`（4 字节位混合）与 `qwe`（求和）的中间值未做数值验证**：hkey 的 2 位数字部分
   （`Vwe(md5后6位charCode) % 100`）我只读了代码，没有实际跑一遍验证输出分布。
3. **`/bbs/app/profile/follower/list` 与 `/bbs/app/profile/following/list` 的参数未确定**：
   只找到了 `$get` 包装（`index-DCMl5r75.js`，导出 `a`/`g`），没有找到带对象实参的调用点
   （消费方可能在主 bundle 且以别名调用，未继续追）。**参数名属于推测，故不写入接口表。**
4. **若干接口只找到路径字面量、没找到请求构造函数**（标为“低”）：
   `/bbs/app/api/general/search/v1/web`、`/bbs/app/link/tree/v2`、`/bbs/app/link/tree/backend`、
   `/bbs/app/profile/user/link/list`、`/bbs/app/profile/user/link/list/v2`、
   `/chatroom/mobile/search/joined_rooms`、`/bbs/app/api/web/share`、`/account/privacy_introduce/`。
   其中前 5 个已确认**只**出现在验证码 appid 白名单里，**网页是否真的调用它们无法从这份 bundle 判定**。
5. **`/bbs/app/api/qcloud/cos/upload/*` 系列与 `/bbs/app/link/vote`、`/bbs/app/link/delete`、`/bbs/app/link/change/status`、`/bbs/app/link/edit/info`、
   `/bbs/app/api/original/image`、`/bbs/app/api/qcloud/cos/copy/image/by/url`：只找到请求构造函数，参数名未知。**
6. **`need_encrypt` 的实际作用未确定。** 主 bundle 里有一个默认选项对象
   `{cancel_http_redirect:0, need_encrypt:1, show_toast:1, add_client_pkey:1, jsInWeb:!0, needCookie:!0, discard_client_params:!1}`，
   且多处业务代码显式传 `{need_encrypt:0, ...}`（只在 `Hr` 客户端分支）。**但我没有找到消费 `need_encrypt` 的位置**
   （它不在 axios 实例 `En` 的 `transformRequest=[DEe,NEe]` 里，看起来属于 `Hr`/客户端传输那套默认配置）。
   因此“Web 端 axios 请求的 body/params 是否被加密”**无法从现有证据判定**。bundle 里确实存在
   `getAESKey: Sz`（`so.AES.encrypt(..., so.enc.Utf8.parse("abcdefghijklmnop"))` 附近）、`getEncrypt: Cve`、
   `getEncryptWithGzip: Eve`、`getHeyboxRSA: Oc`，但没有把它们接到 axios 请求上的直接证据。
7. **`Hr` 客户端（导出别名 `b`）的传输方式未确认。** 它形如 `Hr(e){return UEe.request(e)}`，
   `UEe = WEe(()=>Hr.defaults)`，adapter 由 `zEe(e)` 生成并带 `protocol_type:"..."` 分支——
   推测是“在 Heybox 客户端容器里改走原生 App 通道”（`target`/`requestMode:"client"`），
   但**纯浏览器下走不走 `Hr` 没有确证**。绝大多数业务接口在源码中默认走 `En`（axios）。
8. **未做真实流量验证。** 本报告全部结论来自静态源码；**没有任何一条是从实际 HTTP 请求/响应中观察到的**。
   “实际发出的 URL 是否与静态推断完全一致”，需要其他 agent 的真实抓包来交叉验证
   （特别是：公共参数是否真的每次都带、hkey/nonce 的实际取值、`_rnd` 是否只用于评论创建）。
9. **未下载 sourcemap**（`*.js.map`）。若需要更可读的函数名/字段名，可以补下这些 map 再分析。
10. **`device_id` 的实际取值未验证**：代码上来自 fingerprintjs（`Ope.load()` 的 `visitorId`），
    但指纹库版本/算法未追溯，也无法确认真实值格式。
