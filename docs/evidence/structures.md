# 已抓取响应的结构展开（只读，匿名）


==========================================================================
### topic_index
path=/bbs/app/api/post_editor/topic_selection/index  business_params={}  http=200
status='ok'  msg=''
result.keys = ['hashtag_list', 'topic_list']
  result.topic_list: list[4]
  result.hashtag_list: list[20]
status: str = ok
msg: str =
version: str = 1.0
result: dict(2)
  topic_list: list[4]
    [0]:
      name: str = Steam
      hot: dict(3)
      valid: int = 1
      game: dict(1)
      topic_id: int = 425422
      rec_src: str = topic_hot
      pic_url: str = https://cdn.max-c.com/<redacted-path>
  hashtag_list: list[20]
    [0]:
      is_act_hashtag: int = 1
      name: str = 闹鬼爪子Demo试玩
      act_protocol: str = heybox://{"tag":"\u95f9\u9b3c\u722a\u5b50demo\u8bd5\u73a9","protocol_type":"openBBSTag"}
      sub_title: str = 活动
      end_color: str = #0575DB
      dead_line_desc: str = 2026-11-10 10:00:00 截止
      rec_src: str = hashtag_act
      num: dict(2)
      start_color: str = #1A91FE
      id: int = 1494686

==========================================================================
### topic_feeds
path=/bbs/app/topic/feeds  business_params={'topic_id': '7214', 'limit': '5'}  http=200
status='ok'  msg=''
result.keys = ['filters', 'lastval', 'links', 'sort_filter']
  result.lastval =
  result.links: list[20]
  result.sort_filter: list[1]
  result.filters: list[1]
msg: str =
result: dict(4)
  lastval: str =
  links: list[20]
    [0]:
      has_video: int = 0
      up: int = 0
      act_hashtags: list[0]
      hb_rich_texts: list[0]
      content_tags: list[0]
      list_content_tags: list[0]
      linkid: int = 193287711
      userid: int = 18434717
      title: str = 手机欠费快1万了
      description: str = 突然登上了一个很久不用的电话号码震惊中[cube_微笑]
      link_type: int = 1
      link_tag: int = 27
      is_web: int = 1
      use_concept_type: int = 1
      comment_num: int = 145
      link_award_num: int = 105
      down: int = 14
      create_at: int = 1791619921
      modify_at: int = 1791619921
      share_url: str = https://api.xiaoheihe.cn/v3/bbs/app/api/web/share?h_camp=link&h_src=YXBwX3NoYXJl&link_id=cbe2729b08f
      vertical: int = 0
      topics: list[1]
      hashtags: list[1]
      imgs: list[1]
      thumbs: list[1]
      content_type: int = 4
      hide_comment: int = 0
      forward_num: int = 0
      bottom_rich_text: dict(3)
      feedback: list[2]
      user: dict(9)
      h_src: str = dG9waWNfbGlua19saXN0XzcyMTRfX2xpbmtfaWRfXzE5MzI4NzcxMV9fc29ydF9maWx0ZXJfX2hvdC1yYW5rX19yZXF1ZXN0X2lk
  sort_filter: list[1]
    [0]:
      key: str = hot-rank
      text: str = 智能排序
  filters: list[1]
    [0]:
      show_loading: bool = False
      filters: list[0]
      menu_id: int = 51
      topic_id: int = 7214
      title: str = 综合
      type: str = link
      color: str = #5662E4
      post_btn: dict(5)
status: str = ok

  --- FULL result.sort_filter ---
[
 {
  "key": "hot-rank",
  "text": "智能排序"
 }
]

  --- FULL result.filters ---
[
 {
  "show_loading": false,
  "filters": [],
  "menu_id": 51,
  "topic_id": 7214,
  "title": "综合",
  "type": "link",
  "color": "#5662E4",
  "post_btn": {
   "text": "",
   "prompt": "",
   "img": "",
   "disable": false,
   "protocol": "heybox://{\"protocol_type\":\"openRouterPath\",\"path\":\"/bbs/post\",\"params\":{\"h_src\":\"dG9waWNfZGV0YWlsX190b3BpY19pZF9fNzIxNA==\",\"h_src_extra\":{\"source\":\"topic_bbs\"},\"new_style\":1,\"topicinfo\":{\"name\":\"盒友杂谈\",\"pic_url\":\"https://cdn.max-c.com/<redacted-path>",\"topic_id\":\"7214\"}},\"need_login\":\"1\"}"
  }
 }
]

  --- FULL result.lastval ---
""

==========================================================================
### qrcode_url
path=/account/get_qrcode_url/  business_params={}  http=200
status='ok'  msg=''
result.keys = ['expire', 'qr_url']
  result.qr_url = https://api.xiaoheihe.cn/account/qr_login/?qr=<redacted-uuid>&app=web
  result.expire = 120
status: str = ok
msg: str =
version: str = 1.0
result: dict(2)
  qr_url: str = https://api.xiaoheihe.cn/account/qr_login/?qr=<redacted-uuid>&app=web
  expire: int = 120

==========================================================================
### search_general
path=/bbs/app/api/general/search/v1  business_params={'q': '原神', 'search_type': 'general', 'is_pull_down': '0', 'dw': '628', 'offset': '0', 'limit': '3', 'no_more': 'false'}  http=200
status='ok'  msg=''
result.keys = ['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
  result.sort_filter_list: list[0]
  result.time_range_list: list[0]
  result.game_type_list: list[0]
  result.bottom_tips =
  result.items: list[14]
  result.filter_list: list[2]
msg: str =
result: dict(6)
  sort_filter_list: list[0]
  time_range_list: list[0]
  game_type_list: list[0]
  bottom_tips: str =
  items: list[14]
    [0]:
      report_id: str =
      info: dict(1)
      type: str = filter_tag
  filter_list: list[2]
    [0]:
      key: str = sort_filter
      filters: list[4]
      desc: str = 排序方式
status: str = ok

  --- FULL result.filter_list ---
[
 {
  "key": "sort_filter",
  "filters": [
   {
    "desc": "默认排序",
    "key": "default"
   },
   {
    "desc": "最新发布",
    "key": "create_date"
   },
   {
    "desc": "最多点赞",
    "key": "award_num"
   },
   {
    "desc": "最多评论",
    "key": "comment_num"
   }
  ],
  "desc": "排序方式"
 },
 {
  "key": "time_range",
  "filters": [
   {
    "key": "",
    "desc": "不限"
   },
   {
    "desc": "本周",
    "key": "7d"
   },
   {
    "desc": "本月",
    "key": "30d"
   },
   {
    "desc": "半年内",
    "key": "180d"
   },
   {
    "desc": "一年内",
    "key": "360d"
   }
  ],
  "desc": "发布时间"
 }
]

  --- FULL result.bottom_tips ---
""

==========================================================================
### search_link
path=/bbs/app/api/general/search/v1  business_params={'q': '原神', 'search_type': 'link', 'is_pull_down': '0', 'dw': '628', 'offset': '0', 'limit': '3', 'no_more': 'false'}  http=200
status='ok'  msg=''
result.keys = ['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
  result.sort_filter_list: list[0]
  result.time_range_list: list[0]
  result.game_type_list: list[0]
  result.bottom_tips =
  result.items: list[2]
  result.filter_list: list[2]
msg: str =
result: dict(6)
  sort_filter_list: list[0]
  time_range_list: list[0]
  game_type_list: list[0]
  bottom_tips: str =
  items: list[2]
    [0]:
      info: dict(35)
      report_id: str = eyJhIjoidjEiLCJiIjoi5Y6f56WeIiwiYyI6ImxpbmsiLCJkIjoibGluayIsImUiOiIxNzM1Mzk4MTIiLCJmIjoiLSIsImciOjE3
      type: str = link
  filter_list: list[2]
    [0]:
      key: str = sort_filter
      filters: list[4]
      desc: str = 排序方式
status: str = ok

==========================================================================
### search_user
path=/bbs/app/api/general/search/v1  business_params={'q': '原神', 'search_type': 'user', 'is_pull_down': '0', 'dw': '628', 'offset': '0', 'limit': '3', 'no_more': 'false'}  http=200
status='ok'  msg=''
result.keys = ['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
  result.sort_filter_list: list[0]
  result.time_range_list: list[0]
  result.game_type_list: list[0]
  result.filter_list: list[0]
  result.bottom_tips = 目前仅支持搜索发布投稿作者、用户数字ID
  result.items: list[6]
msg: str =
result: dict(6)
  sort_filter_list: list[0]
  time_range_list: list[0]
  game_type_list: list[0]
  filter_list: list[0]
  bottom_tips: str = 目前仅支持搜索发布投稿作者、用户数字ID
  items: list[6]
    [0]:
      info: dict(10)
      report_id: str = eyJhIjoidjEiLCJiIjoi5Y6f56WeIiwiYyI6InVzZXIiLCJkIjoidXNlciIsImUiOiIyNDcxMTM5MiIsImYiOiItIiwiZyI6MTc5
      type: str = user
status: str = ok

==========================================================================
### user_profile
path=/bbs/app/profile/user/profile  business_params={'userid': '59506913'}  http=200
status='ok'  msg=''
result.keys = ['account_detail', 'events_alert_at', 'protocol', 'share_info']
  result.share_info: dict(4)
  result.protocol = heybox://{"protocol_type":"openRouterPath","path":"user_home","params":{"referer":"web_share","useri
  result.account_detail: dict(12)
  result.events_alert_at = 1733398358
msg: str =
result: dict(4)
  share_info: dict(4)
    image: str = https://imgheybox.max-c.com/avatar/<redacted-path>
    desc: str = 小黑盒——高能玩家聚集地
    share_link: str = https://www.xiaoheihe.cn/bbs/user_profile_share?user_id=12f76aa1b3c8&h_src=heyboxapp
    title: str = <已脱敏>的小黑盒个人主页
  protocol: str = heybox://{"protocol_type":"openRouterPath","path":"user_home","params":{"referer":"web_share","useri
  account_detail: dict(12)
    forbid_info: str =
    username: str = <已脱敏>
    friends_count: int = 139
    avatar_config: dict(2)
    userid: int = 59506913
    avatar: str = https://imgheybox.max-c.com/avatar/<redacted-path>
    signature: str = <已脱敏>
    ip_location: str = <已脱敏>
    medals: list[4]
    level_info: dict(2)
    bbs_info: dict(19)
    medal: list[1]
  events_alert_at: int = 1733398358
status: str = ok

==========================================================================
### message_anon
path=/bbs/app/user/message  business_params={'list_type': '0', 'offset': '0', 'limit': '5', 'no_more': 'false'}  http=200
status='ok'  msg=''
result.keys = ['community_notify', 'feedback_unread', 'header', 'message_unread_num', 'messages']
  result.community_notify: dict(0)
  result.feedback_unread = 0
  result.header: list[4]
  result.message_unread_num = 0
  result.messages: list[0]
msg: str =
result: dict(5)
  community_notify: dict(0)
  feedback_unread: int = 0
  header: list[4]
    [0]:
      count: int = 0
      enable_delete: int = 0
      entry: str = comment
      is_top: int = 0
      list_type: int = 0
      message_type: int = 2
      text: str =
      timestamp: int = 0
      user_a: dict(3)
  message_unread_num: int = 0
  messages: list[0]
status: str = ok

==========================================================================
### fav_folders_anon
path=/bbs/app/profile/fav/folders  business_params={}  http=200
status='login'  msg='请登录后使用该功能'
result.keys = []
status: str = login
msg: str = 请登录后使用该功能
version: str = 1.0
result: dict(0)

==========================================================================
### link_tree
path=/bbs/app/link/tree  business_params={'link_id': '193342147', 'page': '1', 'index': '1', 'limit': '5', 'is_first': '1', 'owner_only': '0'}  http=200
status='show_captcha'  msg=''
result.keys = []
msg: str =
result: dict(0)
status: str = show_captcha

==========================================================================
### feeds_nopull
path=/bbs/app/feeds  business_params={'page': '1', 'limit': '3'}  http=200
status='failed'  msg='pull 参数不正确 (0/1)'
result.keys = []
msg: str = pull 参数不正确 (0/1)
result: dict(0)
status: str = failed

==========================================================================
### topic_search_comm
path=/bbs/app/api/post_editor/topic_selection/search  business_params={'q': '原神', 'only_hashtag': '0'}  http=200
status='ok'  msg=''
result.keys = ['search_result']
  result.search_result: list[23]
status: str = ok
msg: str =
version: str = 1.0
result: dict(1)
  search_result: list[23]
    [0]:
      hb2style: dict(2)
      name: str = 原神
      hot: dict(1)
      search_type: str = topic
      game: dict(2)
      irrelevant_topic_ids: list[2]
      topic_id: int = 68834
      rec_src: str = search
      pic_url: str = https://cdn.max-c.com/<redacted-path>
      description: str =