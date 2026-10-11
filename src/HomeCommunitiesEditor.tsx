import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Search, X } from 'lucide-react';
import { errorOf, getCommunities, type ApiError } from './api';
import type { Community } from './data';
import { mergeCommunities } from './community';
import { CommunityIcon, ErrorNotice } from './Online';

export function HomeCommunitiesEditor({ value, catalog, onChange, onReset }: { value: Community[]; catalog: Community[]; onChange: (next: Community[]) => void; onReset: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Community[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let canceled = false;
    setResults([]); setError(null); setLoading(false);
    if (!query.trim()) return;
    setLoading(true);
    const timer = setTimeout(() => void getCommunities(query.trim()).then(items => {
      if (!canceled) setResults(items);
    }).catch(error => { if (!canceled) setError(errorOf(error)); }).finally(() => { if (!canceled) setLoading(false); }), 400);
    return () => { canceled = true; clearTimeout(timer); };
  }, [query, retry]);
  const matchesQuery = (c: Community) => c.name.toLowerCase().includes(query.trim().toLowerCase());
  const choices = mergeCommunities(catalog.filter(matchesQuery), [...value.filter(matchesQuery), ...results]);
  const move = (index: number, step: number) => {
    const next = [...value];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };
  return <div className="home-communities-editor">
    <h3>固定首页社区 <span>{value.length} / 7</span></h3>
    <p className="setting-description">固定社区按所选顺序显示，最多 7 个。剩余位置随机补齐，每次启动重新选择。</p>
    <div className="home-selected" aria-label="首页社区顺序">{value.map((c, index) => <div className="home-selected-row" key={c.id}>
      <span className="home-community-position">{index + 1}</span><CommunityIcon community={c} /><span className="home-community-name">{c.name}</span>
      <button disabled={index === 0} aria-label={`前移${c.name}`} onClick={() => move(index, -1)}><ArrowLeft size={13} /></button>
      <button disabled={index === value.length - 1} aria-label={`后移${c.name}`} onClick={() => move(index, 1)}><ChevronRight size={14} /></button>
      <button aria-label={`移除${c.name}`} onClick={() => onChange(value.filter(item => item.id !== c.id))}><X size={13} /></button>
    </div>)}</div>
    {!value.length && <p className="no-community">未固定社区，首页将全部随机展示。</p>}
    <label className="community-search"><Search size={15} /><input aria-label="搜索首页社区" placeholder="搜索社区" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && <ErrorNotice error={error} retry={() => setRetry(n => n + 1)} />}
    {loading && <p className="home-search-status" role="status">正在搜索社区…</p>}
    <div className="filter-community-grid home-community-choices">{choices.map(c => {
      const checked = value.some(item => item.id === c.id);
      return <button key={c.id} className={`filter-community ${checked ? 'checked' : ''}`} aria-pressed={checked} disabled={!checked && value.length >= 7} onClick={() => onChange(checked ? value.filter(item => item.id !== c.id) : [...value, c])}>
        <CommunityIcon community={c} /><span>{c.name}</span><span className="checkbox">{checked && <Check size={12} />}</span>
      </button>;
    })}</div>
    {!choices.length && !loading && !error && <p className="no-community">没有找到这个社区</p>}
    <button className="text-button" onClick={onReset}>恢复默认首页社区</button>
  </div>;
}
