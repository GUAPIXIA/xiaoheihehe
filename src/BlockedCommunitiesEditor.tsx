import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { errorOf, getCommunities, type ApiError } from './api';
import type { Community } from './data';
import { mergeCommunities } from './community';
import { CommunityIcon, ErrorNotice } from './Online';

export function BlockedCommunitiesEditor({ excluded, catalog, onChange }: {
  excluded: number[]; catalog: Community[]; onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Community[]>([]);
  const [known, setKnown] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResults([]); setError(null); setLoading(false);
    if (!query.trim()) return;
    let canceled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void getCommunities(query.trim()).then(items => {
        if (canceled) return;
        setResults(items); setKnown(previous => mergeCommunities(previous, items));
      }).catch(error => { if (!canceled) setError(errorOf(error)); })
        .finally(() => { if (!canceled) setLoading(false); });
    }, 400);
    return () => { canceled = true; clearTimeout(timer); };
  }, [query, retry]);
  const directory = mergeCommunities(catalog, known);
  const matches = (c: Community) => c.name.toLowerCase().includes(query.trim().toLowerCase());
  const choices = mergeCommunities(directory.filter(matches), results);
  return <div className="blocked-communities-editor">
    <h3>屏蔽社区 <span>{excluded.length ? `已屏蔽 ${excluded.length} 个` : ''}</span></h3>
    <p className="setting-description">可选择多个社区，属于任一屏蔽社区的帖子将从首页隐藏。点击已选社区可取消屏蔽，设置自动保存。</p>
    <div className="blocked-community-list" aria-label="已屏蔽社区">{excluded.map(id => {
      const name = directory.find(c => c.id === id)?.name ?? `社区 ${id}`;
      return <button key={id} className="blocked-community-chip" aria-label={`取消屏蔽${name}`} onClick={() => onChange(excluded.filter(item => item !== id))}>{name}<X size={12} /></button>;
    })}</div>
    <label className="community-search"><Search size={15} /><input aria-label="搜索屏蔽社区" placeholder="搜索社区" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && <ErrorNotice error={error} retry={() => setRetry(n => n + 1)} />}
    {loading && <p className="home-search-status" role="status">正在搜索社区…</p>}
    <div className="filter-community-grid blocked-community-choices">{choices.map(c => {
      const checked = excluded.includes(c.id);
      return <button key={c.id} className={`filter-community ${checked ? 'checked' : ''}`} aria-label={`${checked ? '取消屏蔽' : '屏蔽'}${c.name}`} aria-pressed={checked} disabled={!checked && excluded.length >= 256} onClick={() => onChange(checked ? excluded.filter(id => id !== c.id) : [...excluded, c.id])}>
        <CommunityIcon community={c} /><span>{c.name}</span><span className="checkbox">{checked && <Check size={12} />}</span>
      </button>;
    })}</div>
    {!choices.length && !loading && !error && <p className="no-community">没有找到这个社区</p>}
    {excluded.length > 0 && <button className="text-button" onClick={() => onChange([])}>清空屏蔽社区</button>}
  </div>;
}
