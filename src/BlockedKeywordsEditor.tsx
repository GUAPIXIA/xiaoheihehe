import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export function BlockedKeywordsEditor({ keywords, onChange }: { keywords: string[]; onChange: (keywords: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const seen = new Set(keywords.map(word => word.toLowerCase()));
    const incoming = draft.split(/\r?\n/).map(word => word.trim()).filter(Boolean);
    if (!incoming.length) { setError('请输入关键词'); return; }
    if (incoming.some(word => Array.from(word).length > 100)) { setError('每个关键词最多 100 个字符'); return; }
    const next = [...keywords];
    for (const word of incoming) if (!seen.has(word.toLowerCase())) { next.push(word); seen.add(word.toLowerCase()); }
    if (next.length > 128) { setError('最多添加 128 个关键词'); return; }
    onChange(next); setDraft(''); setError('');
  };
  return <div className="blocked-keywords-editor">
    <h3>关键词屏蔽 <span>{keywords.length ? `${keywords.length} 个关键词` : ''}</span></h3>
    <p className="setting-description">仅检查首页帖子的标题和显示的摘要，包含任一关键词时隐藏。按文字包含匹配，英文不区分大小写。</p>
    <form className="keyword-form" onSubmit={event => { event.preventDefault(); add(); }}>
      <label htmlFor="blocked-keyword-input">添加关键词</label>
      <textarea id="blocked-keyword-input" aria-label="屏蔽关键词" rows={3} placeholder="每行一个关键词，可一次添加多个" value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} />
      {error && <p className="keyword-error" role="alert">{error}</p>}
      <button type="submit" className="secondary-button"><Plus size={13} />添加关键词</button>
    </form>
    <div className="keyword-list" aria-label="已屏蔽关键词">{keywords.map(word => <button key={word.toLowerCase()} className="blocked-community-chip" aria-label={`移除关键词 ${word}`} title={`移除 ${word}`} onClick={() => onChange(keywords.filter(item => item !== word))}>{word}<X size={12} /></button>)}</div>
    {!keywords.length && <p className="no-community">尚未添加屏蔽关键词</p>}
    {keywords.length > 0 && <button className="text-button" onClick={() => onChange([])}>清空关键词</button>}
  </div>;
}
