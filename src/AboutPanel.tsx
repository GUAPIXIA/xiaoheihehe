import { ExternalLink } from 'lucide-react';
import { errorOf, openOfficial } from './api';

const links = [
  { label: 'GitHub · 项目源码', url: 'https://github.com/GUAPIXIA/xiaoheihehe', address: 'github.com/GUAPIXIA/xiaoheihehe' },
  { label: 'B 站 · 超级本推荐', url: 'https://space.bilibili.com/455009957?spm_id_from=333.1007.0.0', address: 'space.bilibili.com/455009957' },
];

export function AboutPanel({ dataDirectory, notify }: { dataDirectory: string; notify: (message: string) => void }) {
  const open = (url: string) => void openOfficial(url).catch(error => notify(errorOf(error).message));
  return <div className="about-panel">
    <img className="box-logo large-logo" src="/branding/heybox-icon.png" alt="小黑盒盒图标" />
    <h3>小黑盒盒</h3>
    <p>Windows 第三方社区客户端</p>
    <span className="version-pill">0.1.0</span>
    <p className="about-description">浏览、交流，发现喜欢的游戏。<br />已接入真实社区，支持扫码登录。收藏保存在本机。</p>
    <div className="about-links">{links.map(link => <a key={link.url} className="about-link" href={link.url} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); open(link.url); }}>
      <span><strong>{link.label}</strong><small>{link.address}</small></span>
      <ExternalLink size={14} />
    </a>)}</div>
    <button className="text-button" onClick={() => open('https://xiaoheihe.cn/app/bbs/home')}>前往官方社区<ExternalLink size={12} /></button>
    {dataDirectory && <small className="data-directory">数据目录：{dataDirectory}</small>}
  </div>;
}
