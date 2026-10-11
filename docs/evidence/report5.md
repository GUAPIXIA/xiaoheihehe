# 第五轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:03:20

## 1. /bbs/app/topic/feeds 稳定性：连续两次相同请求
  A 条数=18  B 条数=17
  A ∩ B = 0 条
  说明：若高度重合则 topic/feeds 是稳定列表，可安全用于分页与去重。
  A 前5 = [193301396, 193247583, 193297252, 193238383, 193273880]
  B 前5 = [193335920, 193297082, 193311139, 193300875, 193010831]

## 2. /bbs/app/topic/feeds 的 sort_filter 取值
  sort_filter='hot-rank' -> status='ok' msg='' 条数=17 返回的 sort_filter=[{"key": "hot-rank", "text": "智能排序"}]
    linkid 前5 = [193315100, 193258629, 193216552, 193229856, 193140430]
  sort_filter='' -> status='ok' msg='' 条数=17 返回的 sort_filter=[{"key": "hot-rank", "text": "智能排序"}]
    linkid 前5 = [193241679, 193215311, 193249798, 193096845, 193232915]

## 3. 响应的顶层/result 包装差异（结构证据）
  /bbs/app/profile/following/list
    顶层键 = ['follow_cnt', 'follow_list', 'msg', 'status', 'summary_url']
    是否有 result 包装 = False
    顶层列表 follow_list[159]
    顶层列表 summary_url[2]
  /bbs/app/profile/follower/list
    顶层键 = ['follow_cnt', 'follow_list', 'msg', 'status', 'summary_url']
    是否有 result 包装 = False
    顶层列表 follow_list[5]
    顶层列表 summary_url[1]
  /bbs/app/profile/events
    顶层键 = ['msg', 'result', 'status']
    是否有 result 包装 = True
  /bbs/app/topic/feeds
    顶层键 = ['msg', 'result', 'status']
    是否有 result 包装 = True
  /bbs/app/feeds
    顶层键 = ['msg', 'result', 'status']
    是否有 result 包装 = True

## 4. /bbs/app/profile/events 的游标字段
  result.keys = ['lastval', 'moments', 'user']
  lastval = '1790135667.844'
  moments 条数 = 32
  moments[0].keys = ['act_hashtags', 'bottom_rich_text', 'comment_num', 'content_tags', 'content_type', 'create_at', 'description', 'down', 'feedback', 'forward_num', 'h_src', 'has_video', 'hashtags', 'hb_rich_texts', 'hide_comment', 'img_show_type', 'img_text_margin', 'imgs', 'is_top_link', 'is_web', 'link_award_num', 'link_tag', 'link_type', 'linkid', 'list_content_tags', 'modify_at', 'positions', 'share_url', 'thumbs', 'title', 'topics', 'up', 'use_concept_type', 'user', 'userid', 'vertical']
  moments[0] 摘要 = {"has_video": 0, "use_concept_type": 0, "up": 0, "down": 0, "act_hashtags": [], "hb_rich_texts": [], "feedback": [], "content_tags": [], "list_content_tags": [], "linkid": 162599673, "userid": 59506913, "title": "这是一封寄给盒友们的情书💌", "description": "借着八周年，讲一讲我和小黑盒的故事在读大学之前，受于家庭环境，不知道电脑上有steam这种游戏平台，所以steam注册的也晚，周末回家都是玩王者这种可以在父母手机上玩的游戏因此压根都没听过小黑盒这号平台的存在，现在只觉相见很晚。xhh的签到机制很方便，因此", "link_type": 1, "link_tag": 1, "is_web": 1, "comment_num": 80, "link_award_num": 237, "create_at": 1755999443, "modify_at":
  user.keys = ['post_article_count']