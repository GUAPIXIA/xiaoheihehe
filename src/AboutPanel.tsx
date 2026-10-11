import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { api, errorOf, openOfficial, type UpdateInfo } from './api';
import { version } from '../package.json';

const links = [
  { label: 'GitHub · 项目源码', url: 'https://github.com/GUAPIXIA/xiaoheihehe', address: 'github.com/GUAPIXIA/xiaoheihehe' },
  { label: 'B 站 · 超级本推荐', url: 'https://space.bilibili.com/455009957?spm_id_from=333.1007.0.0', address: 'space.bilibili.com/455009957' },
];

export function AboutPanel({ dataDirectory, notify }: { dataDirectory: string; notify: (message: string) => void }) {
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState('');
  const checkUpdate = async () => {
    if (checking) return;
    setChecking(true); setUpdateError(''); setUpdate(null);
    try { setUpdate(await api<UpdateInfo>('checkUpdate')); }
    catch (error) { setUpdateError(errorOf(error).message); }
    finally { setChecking(false); }
  };
  const open = (url: string) => void openOfficial(url).catch(error => notify(errorOf(error).message));
  return <div className="about-panel">
    <img className="box-logo large-logo" src="/branding/heybox-icon.png" alt="小黑盒盒图标" />
    <h3>小黑盒盒</h3>
    <p>Windows 第三方社区客户端</p>
    <span className="version-pill">{version}</span>
    <div className="about-update">
      <button className="text-button" disabled={checking} onClick={() => void checkUpdate()}><RefreshCw size={12} className={checking ? 'is-spinning' : ''} />{checking ? '正在检查…' : '检查更新'}</button>
      {updateError && <p role="alert">{updateError}</p>}
      {update && <div role="status">{update.available ? <>
        <strong>发现新版本 {update.version}</strong>
        <p className="update-notes">{update.notes}</p>
        <button className="primary-button" onClick={() => open(update.downloadUrl)}>下载安装包 · {(update.size / 1024 / 1024).toFixed(2)} MiB<ExternalLink size={12} /></button>
        <small>下载后运行安装包完成更新</small>
      </> : <p>当前已是最新版本（{update.currentVersion}）</p>}</div>}
    </div>
    <p className="about-description">浏览、交流，发现喜欢的游戏。<br />已接入真实社区，支持扫码登录。收藏保存在本机。</p>
    <div className="about-links">{links.map(link => <a key={link.url} className="about-link" href={link.url} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); open(link.url); }}>
      <span><strong>{link.label}</strong><small>{link.address}</small></span>
      <ExternalLink size={14} />
    </a>)}</div>
    <button className="text-button" onClick={() => open('https://xiaoheihe.cn/app/bbs/home')}>前往官方社区<ExternalLink size={12} /></button>
    {dataDirectory && <small className="data-directory">数据目录：{dataDirectory}</small>}
  </div>;
}
