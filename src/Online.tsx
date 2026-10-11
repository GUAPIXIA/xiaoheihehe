import { useEffect, useRef, useState } from 'react';
import { RefreshCw, User } from 'lucide-react';
import { api, errorOf, openOfficial, type Account, type ApiError, type Qr, type QrStatus } from './api';
import type { Community, Post } from './data';

export function CommunityIcon({ community }: { community: Community }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="community-icon" style={{ background: community.color }}>{community.icon && failedUrl !== community.icon ? <img key={community.icon} src={community.icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(community.icon)} /> : community.short}</span>;
}

export function Avatar({ post }: { post: Pick<Post, 'avatar' | 'avatarUrl' | 'color'> }) {
  return <span className="avatar" style={{ background: post.color }}>{post.avatarUrl ? <img src={post.avatarUrl} alt="" referrerPolicy="no-referrer" /> : post.avatar}</span>;
}
export function Badges({ post }: { post: Pick<Post, 'level' | 'medalUrl' | 'medalName'> }) {
  return <>{post.medalUrl && <img className="author-medal" src={post.medalUrl} alt={post.medalName} title={post.medalName} referrerPolicy="no-referrer" />}{post.level > 0 && <span className={`author-level ${post.level >= 20 ? 'high-level' : ''}`}>Lv.{post.level}</span>}</>;
}
export function postTime(post: Pick<Post, 'time' | 'createdAt'>): string {
  if (post.time || !post.createdAt) return post.time;
  const seconds = Math.max(0, Date.now() / 1000 - post.createdAt);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} 天前`;
  return new Date(post.createdAt * 1000).toLocaleDateString('zh-CN');
}
export function ErrorNotice({ error, retry, login }: { error: ApiError; retry: () => void; login?: () => void }) {
  return <div className="online-error" role="alert"><p>{error.message}</p><div><button className="secondary-button" onClick={retry}>重试</button>{(error.code === 'login' || error.code === 'show_captcha' || error.code === 'lack_token') && login && <button className="primary-button" onClick={login}>扫码登录</button>}{error.officialUrl && <button className="text-button" onClick={() => void openOfficial(error.officialUrl!).catch(() => {})}>打开官方页面</button>}</div></div>;
}
export function LoginPanel({ account, onAccount, notify }: { account: Account | null; onAccount: (a: Account | null) => void; notify: (message: string) => void }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [status, setStatus] = useState('正在获取二维码…');
  const [retry, setRetry] = useState(0);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const session = useRef<string | null>(null);
  useEffect(() => {
    if (account) return;
    let canceled = false; let timer: ReturnType<typeof setTimeout>;
    setQr(null); setExpired(false); setStatus('正在获取二维码…');
    async function poll(q: Qr) {
      if (canceled) return;
      if (Date.now() >= q.expiresAt * 1000) { setExpired(true); setStatus('二维码已过期'); return; }
      try {
        const result = await api<QrStatus>('qrPoll', { session: q.session });
        if (canceled) return;
        if (result.state === 'success' && result.account) { onAccount(result.account); notify('扫码登录成功'); return; }
        if (result.state === 'expired' || result.state === 'error') { setExpired(true); setStatus(result.message || '二维码已过期，请刷新'); return; }
        setStatus(result.state === 'scanned' ? '已扫码，请在小黑盒 App 中确认' : '使用小黑盒 App 扫码登录');
        timer = setTimeout(() => void poll(q), 3000);
      } catch (error) { if (!canceled) { setStatus(errorOf(error).message); setExpired(true); } }
    }
    void api<Qr>('qrStart').then(q => {
      if (canceled) { void api('qrCancel', { session: q.session }).catch(() => {}); return; }
      session.current = q.session; setQr(q); setStatus('使用小黑盒 App 扫码登录'); void poll(q);
    }).catch(error => { if (!canceled) { setStatus(errorOf(error).message); setExpired(true); } });
    return () => { canceled = true; clearTimeout(timer); if (session.current) void api('qrCancel', { session: session.current }).catch(() => {}); session.current = null; };
  }, [account?.id, retry]);
  useEffect(() => {
    if (!qr) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil(qr.expiresAt - Date.now() / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [qr]);
  if (account) return <div className="user-panel"><span className="user-avatar">{account.avatarUrl ? <img src={account.avatarUrl} alt="用户头像" referrerPolicy="no-referrer" /> : <User size={32} />}</span><h3>{account.name || `盒友 ${account.id}`}</h3><p>已通过小黑盒 App 扫码登录</p><button className="secondary-button" onClick={() => void api('logout').then(() => { onAccount(null); notify('已退出本地登录'); }).catch(error => notify(errorOf(error).message))}>退出登录</button></div>;
  return <div className="user-panel"><h3>扫码登录小黑盒</h3><p>在小黑盒 App 中打开扫一扫</p><div className={`qr-code ${expired ? 'expired' : ''}`}>{qr && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`} alt="小黑盒登录二维码" />}{expired && <button className="qr-refresh" onClick={() => setRetry(n => n + 1)}><RefreshCw size={22} />刷新二维码</button>}</div><p className="qr-status" role="status">{status}</p>{qr && !expired && <small>{remaining} 秒后过期</small>}<button className="text-button" onClick={() => setRetry(n => n + 1)}><RefreshCw size={13} />换一个二维码</button><p className="account-note">登录信息仅保存在这台电脑。</p></div>;
}
