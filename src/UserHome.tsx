import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ThumbsUp, User } from 'lucide-react';
import { api, errorOf, type Account, type ApiError } from './api';
import type { Post } from './data';
import { ErrorNotice, postTime } from './Online';
import { RichText } from './Emoji';

interface UserPosts { posts: Post[]; lastval: string; hasMore: boolean }
export function UserHome({ initial, onOpenPost, onLogin }: { initial: Account; onOpenPost: (p: Post) => void; onLogin: () => void }) {
  const [profile, setProfile] = useState(initial);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const profileController = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const cursor = useRef('');
  const loadProfile = async () => {
    profileController.current?.abort();
    const request = new AbortController(); profileController.current = request;
    setProfileLoading(true); setProfileError(null);
    try {
      const result = await api<Account>('profile', {id: initial.id}, request.signal);
      if (!request.signal.aborted) setProfile(result);
    } catch (e) { if (!request.signal.aborted) setProfileError(errorOf(e)); }
    finally { if (!request.signal.aborted) setProfileLoading(false); }
  };
  const loadPosts = async () => {
    if (busy.current) return;
    const request = new AbortController(); controller.current = request; busy.current = true;
    setLoading(true); setError(null);
    try {
      const result = await api<UserPosts>('userPosts', {id: initial.id, lastval: cursor.current}, request.signal);
      if (request.signal.aborted) return;
      if (result.hasMore && (!result.lastval || result.lastval === cursor.current)) throw {code:'pagination',message:'主页分页未前进，请重试'};
      setPosts(previous => {
        const ids = new Set(previous.map(p => p.id));
        return [...previous, ...result.posts.filter(p => { if (ids.has(p.id)) return false; ids.add(p.id); return true; })];
      });
      cursor.current = result.lastval; setHasMore(result.hasMore);
    } catch (e) { if (!request.signal.aborted) setError(errorOf(e)); }
    finally { if (!request.signal.aborted) { setLoading(false); busy.current = false; } }
  };
  useEffect(() => {
    void loadProfile(); void loadPosts();
    return () => { controller.current?.abort(); profileController.current?.abort(); busy.current = false; };
    // Parent keys this component by user ID; a new user starts fresh requests and cursors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = (post: Post) => onOpenPost({...post, userId:post.userId || initial.id, author:profile.name || post.author, avatarUrl:post.avatarUrl || profile.avatarUrl, level:post.level || profile.level || 0});
  return <div className="user-home">
    <div className="user-home-profile"><span className="user-home-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="盒友头像" referrerPolicy="no-referrer" /> : <User size={28} />}</span><div><h3>{profile.name || `盒友 ${profile.id}`}{!!profile.level && <span className="author-level">Lv.{profile.level}</span>}</h3><p>{profile.bio || (profileLoading ? '正在读取个人资料…' : '这个盒友还没有留下介绍')}</p></div></div>
    {profileError && <ErrorNotice error={profileError} retry={() => void loadProfile()} login={onLogin} />}
    <h3 className="user-home-heading">发布内容</h3>
    <div className="post-list">{posts.map(post => <article className="post-card user-home-post" key={post.id} onClick={event => { if (!(event.target as Element).closest('button, a')) open(post); }}>
      <button className="post-content" onClick={() => open(post)}><h2><RichText text={post.title || '查看帖子'} /></h2><p><RichText text={post.excerpt} /></p></button>
      {post.images.length > 0 && <button className="user-home-images" aria-label={`打开 ${post.title} 的帖子`} onClick={() => open(post)}>{post.images.slice(0,3).map(src => <img key={src} src={src} alt="帖子配图" loading="lazy" referrerPolicy="no-referrer" />)}</button>}
      <div className="user-home-post-meta"><span>{postTime(post)}{post.kind && ` · ${post.kind}`}</span><span><ThumbsUp size={13} />{post.likes}<MessageCircle size={13} />{post.comments}</span></div>
    </article>)}</div>
    {loading && <p className="loading-state" role="status">正在读取发布内容…</p>}
    {error && <ErrorNotice error={error} retry={() => void loadPosts()} login={onLogin} />}
    {!loading && !error && !posts.length && !hasMore && <p className="loading-state">这个盒友还没有发布内容</p>}
    {hasMore && !error && <button className="secondary-button more-comments" disabled={loading} onClick={() => void loadPosts()}>加载更多内容</button>}
    {!loading && !error && posts.length > 0 && !hasMore && <p className="feed-end">暂时看到这里</p>}
  </div>;
}
