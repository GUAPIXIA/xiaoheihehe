# 第六轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:05:37

## 1. /bbs/app/topic/categories（社区目录）
  http=200 status='ok' msg=''
  result.keys = ['categories', 'follow_topic_limit', 'latest_hot_topics', 'recommend_for_user_topics', 'subscribed_topics']
    follow_topic_limit = 12
    recommend_for_user_topics: dict(3) keys=['children', 'key', 'name']
    latest_hot_topics: dict(3) keys=['children', 'key', 'name']
    categories: list[0]
    subscribed_topics: dict(3) keys=['children', 'key', 'name']
  递归统计：含 topic_id 的节点数 = 75
  前若干 (topic_id, name) = [(425422, 'Steam'), (43, 'CS2'), (611472, '三角洲行动 '), (18745, '数码硬件'), (549999, '校园生活'), (1, 'PC游戏'), (7214, '盒友杂谈'), (55058, '英雄联盟'), (733575, '影之刃零'), (23799, '明日方舟'), (549998, '百科知识'), (73907, '沙雕日常'), (68079, '动漫'), (68834, '原神'), (7216, '绝地求生'), (235709, '无畏契约'), (416158, '情投一盒'), (3082, '巫师3：狂猎 - 重制版'), (667910, '鸣潮'), (727140, '明日方舟：终末地'), (426719, 'Epic平台'), (550000, '职场工作'), (608430, '我的世界JAVA版'), (57602, 'Apex 英雄'), (549997, '汽车'), (65513, '赛博朋克2077'), (582070, '绝区零'), (21972, '影视'), (714349, '逃离塔科夫'), (450671, '碧蓝档案'), (563627, '守望先锋'), (416845, '逃生：试炼'), (423009, '美食'), (599558, '杀戮尖塔2'), (49446, '怪物猎人：世界'), (799926, '艾希：续'), (23563, '主机游戏'), (558683, '绝地潜兵2'), (1844, '战争雷霆'), (442871, '艾尔登法环')]

## 2. /bbs/app/topic/menu（社区详情 + 分区菜单）

  topic_id=7214 -> http=200 status='ok' msg=''
    result.keys = ['menu', 'mini_programs', 'topic']
    topic.keys = ['hb2style', 'name', 'pic_url', 'topic_id']
    topic.topic_id=7214 name='盒友杂谈'
    menu: list[2]
      menu item keys=['color', 'filters', 'menu_id', 'show_loading', 'title', 'topic_id', 'type']
        {"show_loading": false, "menu_id": 51, "topic_id": 7214, "title": "社区", "type": "link", "color": "#5662E4", "filters": [{"show_loading": false, "filters": [], "menu_id": 51, "topic_id": 7214, "title": "综合", "type": "link", "color": "#5662E4", "post_btn": {"text": "", "prompt": "", "img": "", "disable": false, "protocol": "heybox://{\"protocol_type\":\"openRouterPath\",\"path\":\"/bbs/post\",\"para
      menu item keys=['color', 'filters', 'menu_id', 'params', 'show_loading', 'title', 'topic_id', 'type']
        {"show_loading": false, "filters": [], "menu_id": 52, "topic_id": 7214, "title": "头条", "type": "news", "color": "#3E8AE2", "params": {"cate_id": 10}}

  topic_id=425422 -> http=200 status='ok' msg=''
    result.keys = ['menu', 'mini_programs', 'topic']
    topic.keys = ['game', 'hb2style', 'name', 'pic_url', 'topic_id']
    topic.topic_id=425422 name='Steam'
    menu: list[3]
      menu item keys=['appid', 'color', 'filters', 'game_type', 'menu_id', 'show_loading', 'title', 'topic_id', 'type']
        {"menu_id": 0, "show_loading": false, "filters": [], "topic_id": 425422, "title": "游戏", "type": "game", "color": "#64696E", "appid": 99928013, "game_type": "mobile"}
      menu item keys=['color', 'filters', 'menu_id', 'show_loading', 'title', 'topic_id', 'type']
        {"show_loading": false, "menu_id": 3044, "topic_id": 425422, "title": "社区", "type": "link", "color": "#5662E4", "filters": [{"show_loading": false, "filters": [], "menu_id": 3044, "topic_id": 425422, "title": "综合", "type": "link", "color": "#5662E4", "post_btn": {"text": "", "prompt": "", "img": "", "disable": false, "protocol": "heybox://{\"protocol_type\":\"openRouterPath\",\"path\":\"/bbs/post\
      menu item keys=['color', 'filters', 'menu_id', 'params', 'show_loading', 'title', 'topic_id', 'type']
        {"show_loading": false, "filters": [], "menu_id": 3045, "topic_id": 425422, "title": "头条", "type": "news", "color": "#3E8AE2", "params": {"cate_id": 10}}

## 3. /bbs/app/feeds 网页端真实写法（pull=0, offset, dw）
  pull=0 offset=0  -> status='ok' 条数=10
  pull=0 offset=30 -> status='ok' 条数=10
  offset0 ∩ offset30 = 0
  offset0 linkid = [193262244, 193272402, 192437514, 191362125, 191858991, 193147601, 193302743, 193211145, 193278991, 193266035]
  offset30 linkid = [193152694, 193308957, 193240930, 193286499, 193339384, 193333900, 193269876, 193317213, 193130873, 193124516]

## 4. /bbs/app/topic/feeds/news 稳定性（关键：是否存在稳定时间序列表）
  A -> status='ok' msg='' 条数=19
  B -> status='ok' msg='' 条数=19
  A ∩ B = 19 条
  A = [193348728, 193355909, 193353238, 193354236, 193355199, 193251645, 193224516, 193351340, 193316760, 193349564, 193350477, 193351431, 193345304, 192906864, 193346404, 193327131, 193235425, 193345539, 193291122]
  B = [193348728, 193355909, 193353238, 193354236, 193355199, 193251645, 193224516, 193351340, 193316760, 193349564, 193350477, 193351431, 193345304, 192906864, 193346404, 193327131, 193235425, 193345539, 193291122]
  result.keys = ['lastval', 'link_ids', 'links']
  lastval = '1791609484000'
  sort_filter = null
  create_at 序列 = [None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None]
  数值条数=0  是否单调不增 = N/A
  A 的 topics = [(7214,), (7214,), (7214,), (73906,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,)]

## 5. /bbs/app/topic/feeds/news 翻页（offset）
  offset=10 -> status='ok' 条数=19
  offset0 ∩ offset10 = 19 条

## 6. /bbs/app/link/tree/v2（匿名）
  link_id = 193348728
  -> http=200 status='show_captcha' msg=''