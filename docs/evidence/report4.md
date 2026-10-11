# 第四轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:02:42

## 1. /bbs/app/feeds 稳定性对照：两次参数完全相同的请求
  请求A 条数=10  linkid=[193265192, 193201166, 193122523, 193324319, 193195291, 193283926, 193170246, 193144598, 193337626, 193342125]
  请求B 条数=10  linkid=[193340007, 193297244, 193165098, 193203715, 193202546, 193212990, 193309343, 193177814, 193332211, 193335920]
  A ∩ B = 0 条
  A ∪ B = 20 条
  说明：若两次相同请求返回的集合高度不重合，则该接口不是稳定分页列表。

## 2. /bbs/app/topic/feeds 分页与 limit 强制性
  不带 limit -> status='failed' msg='请求参数 "limit" 缺失' result=[]
  limit=20 sort_filter=hot-rank -> status='ok' msg='' result=['filters', 'lastval', 'links', 'sort_filter'] links[18] sort_filter[1] filters[1]
    lastval = ''
    linkid(18) = [193313810, 193268789, 193344905, 193209736, 193221129, 193348249, 193348752, 193307753, 193308581, 193207962, 193305962, 193274114, 193253170, 193302798, 193350468, 193274926, 193323334, 193340761]
    sort_filter = [{"key": "hot-rank", "text": "智能排序"}]
    filters 长度=1
      menu_id=51 topic_id=7214 title='综合' type='link' 内层filters=0

  --- 第二页 ---
  lastval 为空，改用 offset=20 试探
  offset=20 -> status='ok' msg='' result=['filters', 'lastval', 'links', 'sort_filter'] filters[0] links[17] sort_filter[1] 条数=17
    p1 ∩ offset20 = 0 条
    linkid = [193303139, 191433699, 193154286, 193311296, 193192946, 193244445, 193229150, 193224425, 193338431, 193266466, 193243054, 193297226, 193264090, 193239647, 193289190, 193212673, 193090166]

## 3. 另一个社区（Steam 425422）的 filters / 分区结构
  topic_id=425422 -> status='ok' msg='' result=['filters', 'lastval', 'links', 'sort_filter'] links[19] sort_filter[1] filters[1]
    lastval = ''
    sort_filter = [{"key": "hot-rank", "text": "智能排序"}]
    filters: menu_id=3044 topic_id=425422 title='综合' type='link'
    条数=19

## 4. 通用搜索 topic_id 限定社区的命中率（limit=10）
  topic_id=None -> status='ok' msg='' result=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list'] sort_filter_list[0] time_range_list[0] game_type_list[0] items[6] filter_list[2]
    条数=6  link 条数=3
      (188399145, [68834, 21325])
      (183092388, [68834])
      (173539812, [68834])
  topic_id=7214 -> status='ok' msg='' result=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list'] sort_filter_list[0] time_range_list[0] game_type_list[0] items[6] filter_list[2]
    条数=6  link 条数=3
      (183613943, [7214])
      (187336630, [7214])
      (180681089, [7214])
    含 topic_id=7214 的比例 = 3/3

## 5. 关注/粉丝列表匿名返回
  /bbs/app/profile/following/list -> http=200
    原始响应: {"follow_cnt": {"fan_num": 6334, "follow_num": 159, "inter_follow_num": 139}, "follow_list": [{"avartar": "https://imgheybox.max-c.com/avatar/<redacted-path>", "avatar": "https://imgheybox.max-c.com/avatar/<redacted-path>
  /bbs/app/profile/follower/list -> http=200
    原始响应: {"follow_cnt": {"fan_num": 6334, "follow_num": 159, "inter_follow_num": 139}, "follow_list": [{"avartar": "https://imgheybox.max-c.com/avatar/<redacted-path>", "avatar": "https://imgheybox.max-c.com/avatar/<redacted-path>