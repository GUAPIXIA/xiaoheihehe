# 第二轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:00:28
device_id(本地随机, 非账号): 0f1e2d3c4b5a69788796a5b4c3d2e1f0

## A. /bbs/app/feeds 是否必须 pull=1

#### /bbs/app/feeds  (不带 pull)  http=200
    status='failed'
    msg='pull 参数不正确 (0/1)'
    result.keys=[]

## B. 基线 feeds（不带 topic_id）

#### /bbs/app/feeds pull=1  http=200
    status='ok'
    msg=''
    result.keys=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history']
      links[11]
    (linkid, link_tag, topic_ids, content_type) =
       (193342147, 1, (43, 748366), 4)
       (193228167, 1, (21972,), 4)
       (193278557, 27, (579548,), 4)
       (193027281, 1, (53182, 608630), 4)
       (193149935, 27, (425422,), 4)
       (193022200, 1, (7214,), 4)
       (192785182, 1, (583653, 448724), 4)
       (193344351, 27, (727140,), 4)
       (193336886, 1, (7214,), 4)
       (193199490, 27, (744398,), 4)
       (None, None, (), 18)
    link_tag 分布: {1: 6, 27: 4, None: 1}
    出现过的 topic_id: {43: 1, 748366: 1, 21972: 1, 579548: 1, 53182: 1, 608630: 1, 425422: 1, 7214: 2, 583653: 1, 448724: 1, 727140: 1, 744398: 1}

## C. /bbs/app/feeds 是否支持 topic_id（单值）

#### /bbs/app/feeds?topic_id=7214  http=200
    status='ok'
    msg=''
    result.keys=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history']
      links[11]
       (193256260, 11, (7214,), 4)
       (192898546, 27, (2009, 11206), 4)
       (193349564, 11, (7214,), 4)
       (193269370, 27, (563627,), 4)
       (193226973, 27, (22892,), 4)
       (193329352, 11, (425422, 1), 4)
       (191715108, 27, (7214,), 4)
       (193101928, 27, (235709, 22923), 4)
       (193259035, 11, (470329, 21972), 4)
       (192650577, 27, (450671,), 4)
       (None, None, (), 18)
    含 7214 的比例: 3 / 11

## D. /bbs/app/feeds 多值 topic_id 的三种写法

#### /bbs/app/feeds?topic_id=7214&topic_id=425422 (重复参数)  http=200
    status='ok'
    msg=''
    result.keys=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history']
      links[11]
       (193325877, 1, (66738, 581822), 4)
       (193337934, 27, (549999,), 4)
       (193224163, 27, (49558,), 4)
       (193204514, 1, (425422, 733746), 4)
       (193125632, 27, (), 4)
       (193227197, 27, (1844,), 4)
       (193211030, 27, (68079,), 4)
       (193179492, 27, (799926,), 4)
       (193280308, 27, (23799,), 4)
       (193352516, 1, (576694, 4713), 4)
       (None, None, (), 18)

#### /bbs/app/feeds?topic_id=7214,425422 (逗号分隔)  http=200
    status='ok'
    msg=''
    result.keys=['keep_previous', 'links', 'notify_msg', 'show_view_point', 'use_history']
      links[11]
       (193261498, 27, (235709,), 4)
       (193236967, 11, (425422, 1), 4)
       (193165613, 27, (799926,), 4)
       (192936935, 27, (733746,), 4)
       (193342452, 1, (425422, 43), 4)
       (191544279, 27, (7214,), 4)
       (192763606, 27, (579548,), 4)
       (193328347, 27, (611472, 425422), 4)
       (193284575, 27, (18745,), 4)
       (193131115, 27, (60470,), 4)
       (None, None, (), 18)

## E. /bbs/app/topic/feeds（单社区帖子列表）

#### /bbs/app/topic/feeds?topic_id=7214  http=200
    status='ok'
    msg=''
    result.keys=['filters', 'lastval', 'links', 'sort_filter']
      links[20]
      sort_filter[1]
      filters[1]
    列表字段名: links
       (193287711, 27, (7214,))
       (193282389, 27, (7214,))
       (193347412, 27, (7214,))
       (193260274, 27, (7214,))
       (193320456, 1, (7214,))
       (193360454, 11, (7214,))
       (193331116, 27, (7214,))
       (193311811, 11, (7214,))
       (193271209, 27, (7214,))
       (193278991, 27, (7214,))
       (193264201, 27, (7214,))
       (193236581, 27, (7214,))
       (193287461, 27, (7214,))
       (193350477, 11, (7214,))
       (193340007, 27, (7214,))
       (193241311, 27, (7214,))
       (193268648, 27, (7214,))
       (193194535, 27, (7214,))
       (193344902, 27, (7214,))
       (193358371, 27, (7214,))

## F. 社区/分区目录类接口

#### /bbs/app/api/post_editor/topic_selection/index  http=200
    status='ok'
    msg=''
    result.keys=['hashtag_list', 'topic_list']
      topic_list[4]
      hashtag_list[20]

#### /bbs/app/api/post_editor/topic_selection/search?q=原神&only_hashtag=0  http=200
    status='ok'
    msg=''
    result.keys=['search_result']
      search_result[23]

## G. 帖子详情 /bbs/app/link/tree
    使用 link_id = 193342147

#### /bbs/app/link/tree?link_id=<193342147>  http=200
    status='show_captcha'
    msg=''
    result.keys=[]

## H. 扫码登录
#### /account/get_qrcode_url/ (匿名)  http=200
    status = ok
    result.keys = ['expire', 'qr_url']
    qr_url = https://api.xiaoheihe.cn/account/qr_login/?qr=<redacted-uuid>&app=web
    expire = 120
    (完整响应见 raw/qrcode_url.json，交付文档中 qr 参数会脱敏)

## I. 通用搜索 /bbs/app/api/general/search/v1

#### general search q=原神 type=general  http=200
    status='ok'
    msg=''
    result.keys=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
      sort_filter_list[0]
      time_range_list[0]
      game_type_list[0]
      items[14]
      filter_list[2]

#### general search q=原神 type=link  http=200
    status='ok'
    msg=''
    result.keys=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
      sort_filter_list[0]
      time_range_list[0]
      game_type_list[0]
      items[2]
      filter_list[2]

#### general search q=原神 type=user  http=200
    status='ok'
    msg=''
    result.keys=['bottom_tips', 'filter_list', 'game_type_list', 'items', 'sort_filter_list', 'time_range_list']
      sort_filter_list[0]
      time_range_list[0]
      game_type_list[0]
      filter_list[0]
      items[6]

## J. 个人主页（匿名，验证是否要求登录）
    使用 userid = 59506913

#### /bbs/app/profile/user/profile?userid=<59506913>  http=200
    status='ok'
    msg=''
    result.keys=['account_detail', 'events_alert_at', 'protocol', 'share_info']

## K. 需要登录的接口（匿名调用，确认登录要求）

#### /bbs/app/user/message (匿名)  http=200
    status='ok'
    msg=''
    result.keys=['community_notify', 'feedback_unread', 'header', 'message_unread_num', 'messages']
      header[4]
      messages[0]

#### /bbs/app/profile/fav/folders (匿名)  http=200
    status='login'
    msg='请登录后使用该功能'
    result.keys=[]