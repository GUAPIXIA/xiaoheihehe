import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorOf } from './api';

interface Emoji { token: string; name: string; url: string; group: string; groupName: string }
interface Catalog { version: string; emojis: Emoji[] }
const EmojiContext = createContext<{emojis: Emoji[]; loading: boolean; error: string; reload: () => void}>({emojis:[], loading:true, error:'', reload:()=>{}});
let catalogRequest: Promise<Catalog> | null = null;
export function EmojiProvider({children}: {children: ReactNode}) {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let canceled = false; setLoading(true); setError('');
    if (!catalogRequest) catalogRequest = api<Catalog>('emojis');
    void catalogRequest.then(result => { if (!canceled) setEmojis(result.emojis); })
      .catch(e => { catalogRequest = null; if (!canceled) setError(errorOf(e).message); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [revision]);
  return <EmojiContext.Provider value={{emojis,loading,error,reload:()=>setRevision(n=>n+1)}}>{children}</EmojiContext.Provider>;
}
function EmojiImage({emoji}: {emoji: Emoji}) {
  const [failed, setFailed] = useState(false);
  if (failed) return emoji.token;
  return <img className="inline-emoji" src={emoji.url} alt={emoji.token} title={emoji.name} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
export function RichText({text}: {text: string}) {
  const {emojis} = useContext(EmojiContext);
  const catalog = useMemo(() => new Map(emojis.map(emoji => [emoji.token,emoji])), [emojis]);
  if (!catalog.size) return text;
  const parts: ReactNode[] = []; let offset = 0;
  for (const match of text.matchAll(/\[[^\[\]\r\n]{1,80}\]/g)) {
    if (match.index > offset) parts.push(text.slice(offset,match.index));
    const emoji = catalog.get(match[0]);
    parts.push(emoji ? <EmojiImage key={`${match.index}:${emoji.url}`} emoji={emoji} /> : match[0]);
    offset = match.index + match[0].length;
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}
export function EmojiPicker({onSelect}: {onSelect: (token: string) => void}) {
  const {emojis,loading,error,reload} = useContext(EmojiContext);
  const groups = [...new Map(emojis.map(e=>[e.group,e.groupName || e.group])).entries()];
  const [group, setGroup] = useState('');
  const active = groups.some(([id])=>id===group) ? group : groups[0]?.[0];
  return <div className="emoji-picker" aria-label="选择表情">
    {loading && <p role="status">正在读取表情…</p>}
    {error && <p role="alert">{error}<button type="button" onClick={reload}>重试</button></p>}
    <div className="emoji-groups">{groups.map(([id,name])=><button type="button" key={id} className={active===id?'active':''} aria-pressed={active===id} onClick={()=>setGroup(id)}>{name}</button>)}</div>
    <div className="emoji-grid">{emojis.filter(e=>e.group===active).map(emoji=><button type="button" key={emoji.token} title={emoji.name} aria-label={`插入 ${emoji.name} 表情`} onClick={()=>onSelect(emoji.token)}><img src={emoji.url} alt={emoji.name} loading="lazy" referrerPolicy="no-referrer" /></button>)}</div>
  </div>;
}
