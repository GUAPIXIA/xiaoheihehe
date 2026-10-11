# 离线结构分析

## 1. /bbs/app/topic/feeds/news 的条目结构
result.keys = ['lastval', 'link_ids', 'links']
links 条数 = 19
links[*] 字段并集（31 个）= ['act_hashtags', 'comment_num', 'content_tags', 'content_type', 'description', 'down', 'feedback', 'formated_time', 'forward_num', 'h_src', 'has_video', 'hashtags', 'hb_rich_texts', 'hide_comment', 'imgs', 'is_web', 'link_award_num', 'link_tag', 'link_type', 'linkid', 'list_content_tags', 'modify_at', 'post_tag', 'share_url', 'thumbs', 'title', 'topics', 'up', 'use_concept_type', 'userid', 'vertical']
与 /bbs/app/feeds 相比缺少的字段（重要）：
  feeds 有而 news 没有 = ['bottom_rich_text', 'create_at', 'duration', 'feedback_config', 'info', 'story_style', 'user', 'video_info', 'video_thumb', 'video_url']
  news 有而 feeds 没有 = ['formated_time', 'post_tag']

news links[0] 完整内容（截断 2500 字符）：
{
 "has_video": 0,
 "use_concept_type": 0,
 "up": 0,
 "act_hashtags": [],
 "hb_rich_texts": [],
 "content_tags": [],
 "list_content_tags": [],
 "linkid": 193348728,
 "userid": 18054731,
 "title": "年度理财产品：iPhone Duo 苹果折叠机黄牛加价 1.2 万元！！",
 "description": "苹果首款折叠屏手机 iPhone Duo 近日正式开售，市场热度远超预期，因现货稀缺，黄牛渠道加价最高达 1.2 万元，一台难求，被网友戏称为 “年度理财产品”。作为苹果进军折叠屏赛道的重磅之作，iPhone Duo 开售即遭遇抢购潮。官网与零售店订单排队",
 "link_type": 1,
 "link_tag": 11,
 "is_web": 1,
 "comment_num": 18,
 "link_award_num": 5,
 "down": 2,
 "modify_at": 1791621763,
 "share_url": "https://api.xiaoheihe.cn/v3/bbs/app/api/web/share?h_camp=link&h_src=YXBwX3NoYXJl&link_id=cd89729bf755",
 "vertical": 0,
 "topics": [
  {
   "topic_id": 7214,
   "name": "盒友杂谈",
   "pic_url": "https://cdn.max-c.com/<redacted-path>",
   "app_id": -1,
   "hot_value_v2": 90232265
  }
 ],
 "hashtags": [
  {
   "name": "盒友日常",
   "hashtag_id": 8401
  }
 ],
 "imgs": [
  "https://imgheybox.max-c.com/web/bbs/<redacted-path>"
 ],
 "thumbs": [
  "https://imgheybox.max-c.com/web/bbs/<redacted-path>"
 ],
 "content_type": 1,
 "formated_time": "16分钟前",
 "post_tag": "<已脱敏>",
 "hide_comment": 0,
 "forward_num": 0,
 "feedback": [
  {
   "cate": "favour",
   "text": "不感兴趣（选择后将减少相似推荐）",
   "col_count": 2,
   "options": [
    {
     "reason": 8,
     "text": "不喜欢该作者: <已脱敏>",
     "user_id": 18054731,
     "user_name": "<已脱敏>",
     "event_id": "18054731"
    },
    {
     "reason": 18,
     "text": "不喜欢该内容",
     "event_id": "193348728"
    }
   ]
  },
  {
   "cate": "report",
   "text": "内容反馈",
   "col_count": 2,
   "options": [
    {
     "reason": 23,
     "text": "软文广告",
     "event_id": "193348728"
    },
    {
     "reason": 27,
     "text": "标题党",
     "event_id": "193348728"
    },
    {
     "reason": 28,
     "text": "不实炒作",
     "event_id": "193348728"
    },
    {
     "reason": 29,
     "text": "AI生成",
     "event_id": "193348728"
    },
    {
     "reason": 24,
     "text": "内容低俗",
     "event_id": "193348728"
    },
    {
     "reason": 30,
     "text": "分区错误",
     "event_id": "193348728"
    },
    {
     "reason": 10,
     "text": "内容质量差",
     "event_id": "193348728"
    },
    {
     "reason": 22,
     "text": "内容不适",
     "event_id": "193348728"
    }
   ]
  }
 ],
 "h_src": "dG9waWNfbmV3c19saXN0XzcyMT

link_ids 字段 = [193348728, 193355909, 193353238, 193354236, 193355199, 193251645, 193224516, 193351340, 193316760, 193349564, 193350477, 193351431, 193345304, 193346903, 192906864, 193346404, 193327131, 193235425, 193345539, 193291122]
lastval = '1791609484000'  (len=13)
lastval 解析为 UTC 时间 = 2026-10-10 05:18:04


## 2. 各社区帖子列表的「社区归属严格性」统计

| 样本 | 接口 | 期望社区 | 条数 | 命中社区 | 命中率 | 不属于该社区的条目 |
|---|---|---|---|---|---|---|
| topic_feeds | topic_feeds | 7214 | 20 | 20 | 20/20 | [] |
| tf_limit20 | topic/feeds limit=20 | 7214 | 18 | 18 | 18/18 | [] |
| tf_stab_a | topic/feeds 稳定性A | 7214 | 18 | 18 | 18/18 | [] |
| tf_stab_b | topic/feeds 稳定性B | 7214 | 17 | 17 | 17/17 | [] |
| tf_offset20 | topic/feeds offset=20 | 7214 | 17 | 17 | 17/17 | [] |
| tf_steam | topic/feeds topic=425422 | 425422 | 19 | 19 | 19/19 | [] |
| news_p1 | topic/feeds/news | 7214 | 19 | 18 | 18/19 | [(193354236, (73906,))] |
| news_p2 | topic/feeds/news 第二页 | 7214 | 18 | 18 | 18/18 | [] |
| feeds_base | feeds 基线（不限定） | 不限 | 11 | - | - | - |


## 3. 综合信息流 /bbs/app/feeds 的社区分布（说明为何不能服务端过滤）

- `feeds_base`: 条数=11  含多个社区=3  无社区=1
  社区组合 = [(43, 748366), (21972,), (579548,), (53182, 608630), (425422,), (7214,), (583653, 448724), (727140,), (7214,), (744398,), ()]

- `feeds_page1_only`: 条数=11  含多个社区=3  无社区=1
  社区组合 = [(733746,), (558683, 455400), (40,), (7214,), (2108,), (43,), (449338,), (549998, 2009), (425422, 765967), (7214,), ()]

- `feeds_topic_single`: 条数=11  含多个社区=4  无社区=1
  社区组合 = [(7214,), (2009, 11206), (7214,), (563627,), (22892,), (425422, 1), (7214,), (235709, 22923), (470329, 21972), (450671,), ()]

- `stability_a`: 条数=11  含多个社区=2  无社区=2
  社区组合 = [(2009,), (549998,), (7216,), (743405,), (), (583653, 448724), (71077, 664537), (7214,), (5539,), (733575,), ()]

- `stability_b`: 条数=11  含多个社区=2  无社区=3
  社区组合 = [(7214,), (), (677673, 425422), (425422,), (774696, 743405), (611472,), (), (752185,), (549997,), (7214,), ()]


## 4. content_type / link_tag 分布（用于区分真实帖子与广告卡片）

- `feeds_base` content_type 分布 = {4: 10, 18: 1}
  link_tag 分布 = {1: 6, 27: 4, None: 1}

- `news_p1` content_type 分布 = {1: 19}
  link_tag 分布 = {11: 13, 27: 4, 1: 2}

- `topic_feeds` content_type 分布 = {4: 20}
  link_tag 分布 = {27: 16, 1: 1, 11: 3}