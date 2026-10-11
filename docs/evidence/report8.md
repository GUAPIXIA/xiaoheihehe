# 第八轮只读验证报告（匿名 / 无凭据）

生成时间(UTC): 2026-10-10 09:07:36

## 1. 扫码登录流程（匿名）
  步骤1 /account/get_qrcode_url/ -> http=200 status='ok'
    result.keys = ['expire', 'qr_url']
    expire = 120
    qr_url 形态 = https://api.xiaoheihe.cn/account/qr_login/?qr=<uuid>&app=web
    qr 参数长度 = 36  (值已脱敏，不写入文档)
    app 参数 = ['web']
  步骤2 /account/qr_state/?qr=<redacted>&app=web -> http=200
    status = 'ok'
    result = {"error_msg": "", "error": "wait"}
    未扫码时的错误标识 error = 'wait'  error_msg = ''
    (Set-Cookie 中是否出现 user_pkey：本次为匿名未扫码，预期无)

## 2. 单请求指定多个社区（topic/feeds 重复 topic_id）
  -> http=200 status='ok' msg=''
  条数 = 17
  社区组合 = [(7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,), (7214,)]
  含 7214 = 17  含 425422 = 0

## 3. 其它 search_type 取值
  search_type=hashtag        -> status='ok' msg='' items=6 item.type=['hashtag', 'space']
  search_type=game           -> status='ok' msg='' items=3 item.type=['game']
  search_type=mall           -> status='ok' msg='' items=0 item.type=[]
  search_type=mini_program   -> status='show_captcha' msg='' items=0 item.type=[]