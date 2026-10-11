# 第三轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:01:52

## 1. /bbs/app/feeds 的 page 翻页行为
  page=1 -> status='ok' msg='' result=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history'] links[11]  条数=11
  page=2 -> status='ok' msg='' result=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history'] links[11]  条数=11
  page=3 -> status='ok' msg='' result=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history'] links[11]  条数=11
  page1 ∩ page2 重合 linkid 数 = 1
  page2 ∩ page3 重合 linkid 数 = 1
  page1 ∩ page3 重合 linkid 数 = 1
  page=1 linkid: [193296005, 193216275, 193334006, 190910777, 193133375, 193329081, 193273858, 193227914, 193330606, 193348752, None]
  page=2 linkid: [193342784, 193303404, 193308375, 192871658, 193122678, 193288586, 193272365, 193288450, 193201146, 193228189, None]

## 2. /bbs/app/topic/feeds 的游标分页（lastval / offset）
  首页 sort_filter=hot-rank -> status='failed' msg='请求参数 "limit" 缺失' result=[]
    result.lastval = None
    条数=0
  首页 lastval 为空字符串 -> 需要改用 offset 翻页，尝试 offset=20
    offset=20 -> status='failed' msg='请求参数 "limit" 缺失' result=[] 条数=0
    offset=20 的 linkid: []
    p1 ∩ offset20 = 0
    offset=20 的 lastval = None

## 3. 负对照：服务端是否忽略未知参数（用于判断「没有排除参数」的可信度）
  feeds + 伪造的排除参数 -> status='ok' msg='' result=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history'] links[11] 条数=11
  与 page=1 基线重合 = 1/11
  结论依据：若未知参数被忽略则返回内容与基线一致；若报错则说明参数被校验。

## 4. /bbs/app/link/tree 的访问门槛（匿名）
  使用 link_id = 193296005
  [('link_id', '193296005')] -> http=200 status='show_captcha' msg='' result=[]
  [('link_id', '193296005'), ('page', '1'), ('limit', '20')] -> http=200 status='show_captcha' msg='' result=[]
  [('link_id', '193296005'), ('page', '1'), ('index', '2'), ('limit', '20'), ('is_first', '1'), ('owner_only', '0')] -> http=200 status='show_captcha' msg='' result=[]

## 5. 通用搜索是否支持 topic_id（限定社区）
  topic_id=None -> status='ok' msg='' result=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list'] sort_filter_list[0] time_range_list[0] game_type_list[0] items[2] filter_list[2]
    每条的 topics = [[68834, 21325], []]
  topic_id=7214 -> status='ok' msg='' result=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list'] sort_filter_list[0] time_range_list[0] game_type_list[0] items[2] filter_list[2]
    每条的 topics = [[7214], []]

## 6. 其它只读接口
  /bbs/app/profile/events [('list_type', 'moment'), ('userid', '59506913'), ('dw', '628'), ('lastval', '')] -> http=200 status='ok' msg='' result=['lastval', 'moments', 'user'] moments[32]
  /bbs/app/api/emojis/list  -> http=200 status='ok' msg='' result=['emoji_groups', 'emoji_version'] emoji_groups[4]
  /bbs/app/api/search/found  -> http=200 status='ok' msg='' result=['search_found']
  /bbs/app/api/search/welcome_page/v2  -> http=200 status='ok' msg='' result=['Lists', 'ads_banner', 'default_q'] ads_banner[0] Lists[4]
  /bbs/app/profile/following/list [('userid', '59506913')] -> http=200 status='ok' msg='' result=NoneType
  /bbs/app/profile/follower/list [('userid', '59506913'), ('offset', '0'), ('limit', '5')] -> http=200 status='ok' msg='' result=NoneType