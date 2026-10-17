import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, ThumbsUp } from 'lucide-react';
import { api, errorOf, type ApiError } from './api';
import type { Comment } from './data';
import { Badges, ErrorNotice, postTime } from './Online';
import { RichText } from './Emoji';

interface ReplyPage { comments: Comment[]; hasMore: boolean; lastval: string }
// Upstream may include empty/unsafe entries; only active http(s) or same-origin "/path" images are rendered.
export function commentImages(comment: Comment): string[] {
  const images: string[] = [];
  for (const raw of comment.images ?? []) {
    if (typeof raw !== 'string') continue;
    const src = raw.trim();
    if (!/^https?:\/\//i.test(src) && !/^\/(?!\/)/.test(src)) continue;
    if (images.includes(src)) continue;
    images.push(src);
  }
  return images;
}
function CommentImage({ src, alt, label, onOpen }: { src: string; alt: string; label: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className={`comment-image${failed ? ' is-error' : ''}`} aria-label={label} title={label} onClick={onOpen}>
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    {failed && <span className="comment-image-error" aria-hidden="true"><RefreshCw size={12} />加载失败</span>}
  </button>;
}
function CommentImages({ comment, onImage }: { comment: Comment; onImage: (c: Comment, index: number) => void }) {
  const images = commentImages(comment);
  if (!images.length) return null;
  return <div className={`comment-images${images.length === 1 ? ' comment-images-single' : ''}`}>
    {images.map((src, index) => <CommentImage key={src} src={src} alt={`${comment.author} 的评论图片 ${index + 1}`} label={`查看 ${comment.author} 的评论图片 ${index + 1}`} onOpen={() => onImage(comment, index)} />)}
  </div>;
}
export function CommentThread({ comment, onReply, onProfile, onLogin, onImage }: { comment: Comment; onReply: (c: Comment) => void; onProfile: (c: Comment) => void; onLogin: () => void; onImage: (c: Comment, index: number) => void }) {
  const [replies, setReplies] = useState(comment.replies ?? []);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(!!comment.hasMoreReplies);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const preview = comment.replies ?? [];
    setReplies(preview); setExpanded(false); setHasMore(!!comment.hasMoreReplies); setError(null); setLoading(false);
    cursor.current = preview.length ? String(preview[preview.length - 1].id) : '';
    return () => { request.current?.abort(); request.current = null; };
  }, [comment]);
  const loadReplies = async () => {
    if (request.current) return;
    setExpanded(true);
    if (!hasMore) return;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    try {
      const result = await api<ReplyPage>('subComments', { root: comment.id, lastval: cursor.current }, controller.signal);
      if (controller.signal.aborted) return;
      if (result.hasMore && (!result.lastval || result.lastval === cursor.current)) throw { code: 'pagination', message: '回复分页未前进，请重试' };
      setReplies(previous => {
        const ids = new Set(previous.map(c => c.id));
        return [...previous, ...result.comments.filter(c => c.id !== comment.id && !ids.has(c.id) && !!ids.add(c.id))];
      });
      cursor.current = result.lastval; setHasMore(result.hasMore);
    } catch (e) { if (!controller.signal.aborted) setError(errorOf(e)); }
    finally { if (!controller.signal.aborted) { request.current = null; setLoading(false); } }
  };
  const author = (c: Comment) => <strong className="comment-author"><button className="comment-profile-link" onClick={() => onProfile(c)} aria-label={`查看 ${c.author} 的主页`}>{c.author}</button>{c.isAuthor && <span className="comment-author-tag">作者</span>}<Badges post={c} /></strong>;
  return <div className={`comment ${comment.pinned ? 'pinned-comment' : ''}`}>
    {comment.pinned && <span className="comment-pin" title="置顶评论"><span>置顶</span></span>}
    <button className="avatar small-avatar" aria-label={`查看 ${comment.author} 的主页头像`} onClick={() => onProfile(comment)}>{comment.avatarUrl ? <img src={comment.avatarUrl} alt="" referrerPolicy="no-referrer" /> : comment.avatar}</button>
    <div className="comment-content">{author(comment)}<p><RichText text={comment.text} /></p><CommentImages comment={comment} onImage={onImage} /><small>{postTime(comment)}{comment.ipLocation?.trim() && <><span className="meta-dot">·</span><span className="ip-location">{comment.ipLocation}</span></>}<button onClick={() => onReply(comment)}>回复</button></small>
      {(replies.length > 0 || comment.replyCount > 0 || hasMore) && <div className="comment-replies">
        {(expanded ? replies : replies.slice(0, 2)).map(c => <div className="sub-comment" key={c.id}>
          {author(c)}{c.replyTo && <span className="reply-to"> 回复 {c.replyTo}</span>}<p><RichText text={c.text} /></p><CommentImages comment={c} onImage={onImage} />
          <small>{postTime(c)}{c.ipLocation?.trim() && <><span className="meta-dot">·</span><span className="ip-location">{c.ipLocation}</span></>}<button onClick={() => onReply(c)}>回复</button><span className="sub-comment-likes"><ThumbsUp size={11} />{c.likes}</span></small>
        </div>)}
        {error && <ErrorNotice error={error} retry={() => void loadReplies()} login={onLogin} />}
        <div className="reply-navigation">
          {!expanded && (hasMore || replies.length > 2) && <button onClick={() => void loadReplies()} aria-expanded={false}>全部 {comment.replyCount || replies.length} 条回复<ChevronDown size={13} /></button>}
          {expanded && hasMore && !error && <button disabled={loading} onClick={() => void loadReplies()}>{loading ? '正在加载回复…' : '加载更多回复'}<ChevronDown size={13} /></button>}
          {expanded && <button onClick={() => setExpanded(false)} aria-expanded={true}>收起回复<ChevronUp size={13} /></button>}
        </div>
      </div>}
    </div><span className="comment-likes"><ThumbsUp size={12} />{comment.likes}</span>
  </div>;
}
