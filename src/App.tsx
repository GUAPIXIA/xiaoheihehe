import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpToLine, Bookmark, Check, ChevronDown, ChevronRight, ChevronsUpDown, CircleHelp, ExternalLink, Home, Maximize2, MessageCircle, Minus, Moon, MoreHorizontal, PanelTop, PencilLine, RefreshCw, Search, Settings, SlidersHorizontal, Smile, Sun, TextSearch, ThumbsUp, User, X } from 'lucide-react';
import { type Community, type Comment, type Post } from './data';
import { api, desktop, errorOf, getCommunities, openOfficial, windowAction, type Account, type ApiError, type Bootstrap, type Detail } from './api';
import { useSaved, useFeed } from './useBackend';
import { Avatar, Badges, CommunityIcon, ErrorNotice, LoginPanel, postTime } from './Online';
import { fillHomeCommunities, mergeCommunities } from './community';
import { CommentThread } from './CommentThread';
import { UserHome } from './UserHome';
import { EmojiPicker, RichText } from './Emoji';
import { matchesShortcut, resolveKeybindings, shortcutLabel, ShortcutsEditor, type Keybindings } from './Shortcuts';
import { HomeCommunitiesEditor } from './HomeCommunitiesEditor';
import { BlockedCommunitiesEditor } from './BlockedCommunitiesEditor';
import { BlockedKeywordsEditor } from './BlockedKeywordsEditor';

type Page = '首页' | '我的收藏' | '浏览记录';
type FilterMode = 'all' | 'include' | 'exclude';
type Theme = 'light' | 'dark' | 'system';
interface Preferences { theme: Theme; zoom: number; exit: 'close' | 'tray'; shortcuts: boolean; animations: boolean; showSidebar?: boolean; keybindings?: Keybindings; windowHeight?: number; windowWidth?: number }
interface Filter { mode: FilterMode; included: number[]; excluded: number[]; unknown: boolean }

function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}

export default function App() {
  const [prefs, setPrefs, storageError] = useSaved<Preferences>('heybox.preferences', { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: true, showSidebar: false });
  const showSidebar = prefs.showSidebar === true;
  const keybindings = useMemo(() => resolveKeybindings(prefs.keybindings), [prefs.keybindings]);
  const [zoomDraft, setZoomDraft] = useState(prefs.zoom);
  const windowHeight = prefs.windowHeight ?? 760;
  const windowWidth = prefs.windowWidth ?? (showSidebar ? 960 : 720);
  const [widthDraft, setWidthDraft] = useState(windowWidth);
  const widthTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingWidth = useRef<number | undefined>(undefined);
  const [heightDraft, setHeightDraft] = useState(windowHeight);
  const heightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingHeight = useRef<number | undefined>(undefined);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingZoom = useRef<number | undefined>(undefined);
  useEffect(() => { setZoomDraft(prefs.zoom); }, [prefs.zoom]);
  useEffect(() => { setHeightDraft(windowHeight); }, [windowHeight]);
  useEffect(() => { setWidthDraft(windowWidth); }, [windowWidth]);
  useEffect(() => () => { clearTimeout(zoomTimer.current); clearTimeout(heightTimer.current); clearTimeout(widthTimer.current); }, []);
  const [savedFilter, setFilter, filterStorageError, filterHydrated] = useSaved<Filter>('heybox.community-filter', { mode: 'exclude', included: [], excluded: [], unknown: true });
  const filter = useMemo<Filter>(() => ({ mode: 'exclude', included: [], excluded: savedFilter.mode === 'exclude' ? savedFilter.excluded : [], unknown: true }), [savedFilter]);
  useEffect(() => {
    if (filterHydrated && (savedFilter.mode !== 'exclude' || savedFilter.included.length > 0 || !savedFilter.unknown)) setFilter(filter);
  }, [filterHydrated, savedFilter, filter]);
  const [bookmarks, setBookmarks] = useSaved<number[]>('heybox.bookmarks', []);
  const [history, setHistory] = useSaved<number[]>('heybox.history', []);
  const [blockedKeywords, setBlockedKeywords, keywordsStorageError] = useSaved<string[]>('heybox.blocked-keywords', []);
  const keywordMatches = useMemo(() => blockedKeywords.map(word => word.trim().toLowerCase()).filter(Boolean), [blockedKeywords]);
  const [savedHomeCommunities, setHomeCommunities, homeCommunitiesError] = useSaved<Community[] | null>('heybox.home-communities', null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [randomCommunityPool, setRandomCommunityPool] = useState<Community[]>([]);
  const [randomCommunitySeed] = useState(() => Math.floor(Math.random() * 0x100000000));
  const fixedHomeCommunities = (savedHomeCommunities ?? communities.slice(0, 7)).map(saved => {
    const fresh = communities.find(c => c.id === saved.id);
    return fresh ? { ...fresh, icon: fresh.icon || saved.icon } : saved;
  });
  const homeCommunities = fillHomeCommunities(fixedHomeCommunities, randomCommunityPool, randomCommunitySeed).map(c => {
    const fresh = communities.find(item => item.id === c.id);
    return fresh ? { ...fresh, icon: fresh.icon || c.icon } : c;
  });
  const [account, setAccount] = useState<Account | null>(null);
  const [dataDirectory, setDataDirectory] = useState('');
  const [profile, setProfile] = useState<Account | null>(null);
  const postOriginProfile = useRef<Account | null>(null);
  const [communitiesError, setCommunitiesError] = useState<ApiError | null>(null);
  const [page, setPage] = useState<Page>('首页');
  const tab = '推荐';
  const [activeCommunity, setActiveCommunity] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'settings' | 'user' | null>(null);
  const [settingsTab, setSettingsTab] = useState('外观');
  const [selected, setSelected] = useState<Post | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<ApiError | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const [moreComments, setMoreComments] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingLike, setPendingLike] = useState<number | null>(null);
  const [onlineRefresh, setOnlineRefresh] = useState(0);
  const [reply, setReply] = useState('');
  const [emojiPicker, setEmojiPicker] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const replySelection = useRef({start:0,end:0});
  const [notice, setNotice] = useState('');
  const [closed, setClosed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = (message: string) => { clearTimeout(timer.current); setNotice(message); timer.current = setTimeout(() => setNotice(''), 3000); };
  const localIds = page === '我的收藏' ? bookmarks : page === '浏览记录' ? history : null;
  const feed = useFeed({ filter, topic: activeCommunity, query: search, tab, width: 604, refresh: onlineRefresh }, localIds);
  const posts = feed.posts;
  const listContext = JSON.stringify([page, tab, activeCommunity, search, filter, page === '首页' ? blockedKeywords : [], onlineRefresh]);
  const listScroll = useRef<{ context: string; top: number } | null>(null);
  const scrollView = useRef<{ context: string; postId?: number }>({ context: listContext });
  const restoringList = useRef(false);
  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const previous = scrollView.current;
    scrollView.current = { context: listContext, postId: selected?.id };
    if (previous.context !== listContext) {
      listScroll.current = null; restoringList.current = false;
      root.scrollTo({ top: 0, behavior: 'instant' });
    } else if (previous.postId !== selected?.id) {
      if (selected) {
        restoringList.current = false;
        root.scrollTo({ top: 0, behavior: 'instant' });
      } else restoringList.current = true;
    }
    if (!selected && restoringList.current && listScroll.current?.context === listContext) {
      root.scrollTo({ top: listScroll.current.top, behavior: 'instant' });
      // Local lists may still be loading after their IDs change on opening a post.
      if (!feed.loading && (posts.length > 0 || feed.error)) restoringList.current = false;
    }
  }, [listContext, selected?.id, feed.loading, posts.length, feed.error]);
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;

  useEffect(() => {
    if (page !== '首页' || selected || modal || image || profile || closed || minimized || feed.loading || feed.error || !feed.hasMore) return;
    const root = contentRef.current, target = feedEndRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMoreRef.current();
    }, { root, rootMargin: '0px 0px 240px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [page, selected?.id, modal, image, profile, closed, minimized, feed.loading, feed.error, feed.hasMore]);

  const refreshRecommendations = () => {
    listScroll.current = null; restoringList.current = false;
    contentRef.current?.scrollTo({ top: 0 });
    if (activeCommunity !== null || search) {
      setActiveCommunity(null); setSearch('');
    } else feed.reload();
  };

  const scrollDetail = (toComments: boolean) => {
    const root = contentRef.current, target = commentsRef.current;
    if (!root || (toComments && !target)) return;
    const bounds = root.getBoundingClientRect();
    const scale = bounds.height / root.offsetHeight || 1;
    const toolbarHeight = root.querySelector<HTMLElement>('.detail-toolbar')?.offsetHeight ?? 0;
    const top = toComments && target ? Math.max(0, root.scrollTop + (target.getBoundingClientRect().top - bounds.top) / scale - toolbarHeight - 8) : 0;
    const behavior = prefs.animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant';
    root.scrollTo({ top, behavior });
  };

  useEffect(() => {
    let canceled = false;
    void api<Bootstrap>('bootstrap').then(result => { if (!canceled) { setAccount(result.account); setDataDirectory(result.dataDirectory); } }).catch(error => { if (!canceled) notify(errorOf(error).message); });
    void getCommunities().then(result => { if (!canceled) { setCommunities(previous => mergeCommunities(result, previous)); setRandomCommunityPool(previous => previous.length ? previous : result); setCommunitiesError(null); } }).catch(error => { if (!canceled) setCommunitiesError(errorOf(error)); });
    return () => { canceled = true; };
  }, [onlineRefresh]);
  useEffect(() => {
    const extras = posts.flatMap(p => p.topics);
    setCommunities(previous => mergeCommunities(previous, extras));
  }, [posts]);
  useEffect(() => { if (desktop) void windowAction('scale', prefs.zoom, showSidebar, windowHeight, windowWidth).catch(error => notify(errorOf(error).message)); }, [prefs.zoom, showSidebar, windowHeight, windowWidth, maximized]);
  const updatePost = (post: Post) => { feed.setPosts(previous => previous.map(p => p.id === post.id ? post : p)); setSelected(previous => previous?.id === post.id ? post : previous); };
  const requestDetail = async (id: number, pageNumber = 1) => {
    if (detailRequest.current !== id) return;
    if (pageNumber > 1 && detailController.current) return;
    detailController.current?.abort();
    const controller = new AbortController(); detailController.current = controller;
    setDetailLoading(true); setDetailError(null);
    try {
      const result = await api<Detail>('detail', { id, page: pageNumber }, controller.signal);
      if (detailRequest.current !== id || controller.signal.aborted || detailController.current !== controller) return;
      if (result.post) updatePost({ ...result.post, isCy: result.isCy || result.post.isCy });
      setComments(previous => {
        const base = pageNumber === 1 ? [] : previous;
        const ids = new Set(base.map(c => c.id));
        return [...base, ...result.comments.filter(c => !ids.has(c.id) && !!ids.add(c.id))];
      });
      setCommentPage(pageNumber); setMoreComments(result.hasMore && pageNumber < 1000);
    } catch (error) {
      if (detailRequest.current === id && !controller.signal.aborted && detailController.current === controller) {
        failedDetailPage.current = pageNumber; setDetailError(errorOf(error));
      }
    } finally {
      if (detailController.current === controller) { detailController.current = null; setDetailLoading(false); }
    }
  };
  const detailRequest = useRef<number | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const failedDetailPage = useRef(1);
  useEffect(() => {
    detailController.current?.abort(); detailController.current = null;
    detailRequest.current = selected?.id ?? null; setComments([]); setCommentPage(1); setMoreComments(false); setDetailLoading(false); setDetailError(null); setReplyTarget(null); setEmojiPicker(false);
    if (selected) void requestDetail(selected.id);
    return () => { detailController.current?.abort(); detailController.current = null; detailRequest.current = null; };
  }, [selected?.id, onlineRefresh]);
  const loadCommentsRef = useRef<() => void>(() => {});
  loadCommentsRef.current = () => { if (selected && moreComments && !detailError) void requestDetail(selected.id, commentPage + 1); };
  useEffect(() => {
    if (!selected || modal || image || profile || closed || minimized || sending || detailLoading || detailError || !moreComments) return;
    const root = contentRef.current, target = commentsEndRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadCommentsRef.current();
    }, { root, rootMargin: '0px 0px 180px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [selected?.id, modal, image, profile, closed, minimized, sending, detailLoading, detailError, moreComments, commentPage]);
  const loginChanged = (next: Account | null) => { setAccount(next); setOnlineRefresh(n => n + 1); };
  const likePost = async (post: Post) => {
    if (!account) { setModal('user'); return; }
    if (pendingLike !== null) return; setPendingLike(post.id);
    try { await api('like', { id: post.id, liked: !post.liked }); updatePost({ ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) }); }
    catch (error) { notify(errorOf(error).message); if (errorOf(error).code === 'login') { setAccount(null); setModal('user'); } }
    finally { setPendingLike(null); }
  };
  const submitComment = async () => {
    if (!selected || !reply.trim() || sending) return;
    if (!account) { setModal('user'); return; }
    setSending(true);
    try {
      await api('comment', { id: selected.id, text: reply.trim(), reply: replyTarget?.id, root: replyTarget?.rootId, is_cy: selected.isCy });
      setReply(''); setReplyTarget(null); notify('评论已发送'); await requestDetail(selected.id);
    } catch (error) { notify(errorOf(error).message); if (errorOf(error).code === 'login') setAccount(null); }
    finally { setSending(false); }
  };
  const showPersonProfile = (id: string, name = '', avatarUrl = '', level = 0) => {
    if (!/^[1-9]\d{0,19}$/.test(id)) { notify('暂时无法获取这位盒友的主页信息'); return; }
    setProfile({id, name, avatarUrl, level});
  };
  const showProfile = async (post: Post) => {
    let author = post;
    try {
      if (!/^[1-9]\d{0,19}$/.test(author.userId)) {
        const detail = await api<Detail>('detail', {id:post.id, page:1});
        if (detail.post) author = detail.post;
      }
      showPersonProfile(author.userId, author.author, author.avatarUrl, author.level);
    } catch (error) { notify(errorOf(error).message); }
  };
  const leavePost = () => {
    setSelected(null);
    if (postOriginProfile.current) { setProfile(postOriginProfile.current); postOriginProfile.current = null; }
  };
  const closeWindow = async () => {
    try {
      const preferences = { ...prefs, zoom: pendingZoom.current ?? prefs.zoom, windowHeight: pendingHeight.current ?? windowHeight, ...(pendingWidth.current !== undefined ? { windowWidth: pendingWidth.current } : {}) };
      clearTimeout(zoomTimer.current); pendingZoom.current = undefined;
      clearTimeout(heightTimer.current); pendingHeight.current = undefined;
      clearTimeout(widthTimer.current); pendingWidth.current = undefined;
      setPrefs(preferences);
      for (const [key, value] of [['heybox.preferences', preferences], ['heybox.community-filter', filter], ['heybox.bookmarks', bookmarks], ['heybox.history', history], ['heybox.home-communities', savedHomeCommunities], ['heybox.blocked-keywords', blockedKeywords]]) await api('stateSet', { key, value });
      await windowAction('close');
    } catch (error) { notify(errorOf(error).message); }
  };

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => setSystemDark(media.matches);
    window.addEventListener('resize', onResize); media.addEventListener('change', onTheme);
    return () => { window.removeEventListener('resize', onResize); media.removeEventListener('change', onTheme); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if ((modal || image || profile) && (event.key === 'Escape' || (prefs.shortcuts && matchesShortcut(event, keybindings.close)))) {
        event.preventDefault();
        if (image) setImage(null); else if (modal) setModal(null); else setProfile(null);
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]') || modal || image || profile || !prefs.shortcuts) return;
      if (matchesShortcut(event, keybindings.search)) { event.preventDefault(); searchRef.current?.focus(); }
      else if (matchesShortcut(event, keybindings.settings)) { event.preventDefault(); setModal('settings'); }
      else if (matchesShortcut(event, keybindings.back)) { event.preventDefault(); leavePost(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, image, profile, prefs.shortcuts, keybindings, selected?.id]);

  const theme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;
  const toggle = (id: number, items: number[], update: (items: number[]) => void) => update(items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  const openFilter = () => { setSettingsTab('屏蔽社区'); setModal('settings'); };
  const goPage = (next: Page) => { setPage(next); setSelected(null); setActiveCommunity(null); setMenu(false); setSearch(''); };
  const openPost = (post: Post) => {
    if (!selected) listScroll.current = { context: listContext, top: contentRef.current?.scrollTop ?? 0 };
    postOriginProfile.current = null; setSelected(post); setReply(''); setHistory([post.id, ...history.filter(id => id !== post.id)].slice(0, 100));
  };
  const visiblePosts = useMemo(() => {
    let result = posts.filter(post => {
      if (page === '我的收藏' && !bookmarks.includes(post.id)) return false;
      if (page === '浏览记录' && !history.includes(post.id)) return false;
      if (page === '首页') {
        if (activeCommunity && !post.topicIds.includes(activeCommunity)) return false;
        if (post.topicIds.some(id => filter.excluded.includes(id))) return false;
        const title = post.title.toLowerCase(), excerpt = post.excerpt.toLowerCase();
        if (keywordMatches.some(word => title.includes(word) || excerpt.includes(word))) return false;
      }
      const text = `${post.title} ${post.excerpt} ${post.author} ${post.topicIds.map(id => communities.find(c => c.id === id)?.name).join(' ')}`;
      return page === '首页' || text.toLowerCase().includes(search.trim().toLowerCase());
    });
    if (page === '浏览记录') result = [...result].sort((a, b) => history.indexOf(a.id) - history.indexOf(b.id));
    return result;
  }, [posts, communities, page, bookmarks, history, activeCommunity, tab, filter, search, keywordMatches]);

  const scale = prefs.zoom / 100;
  const baseWidth = windowWidth;
  const availableWidth = Math.max(1, viewport.width - (maximized || desktop ? 0 : 48));
  const availableHeight = Math.max(1, viewport.height - (maximized || desktop ? 0 : 64));
  const fit = Math.min(scale, availableWidth / baseWidth, availableHeight / windowHeight);
  const frameWidth = maximized || desktop ? availableWidth : baseWidth * fit;
  const frameHeight = maximized || desktop ? availableHeight : windowHeight * fit;
  const windowStyle = { width: frameWidth, height: frameHeight };
  const patchPrefs = (next: Partial<Preferences>) => {
    if ('windowWidth' in next) {
      clearTimeout(widthTimer.current); pendingWidth.current = undefined;
      setWidthDraft(next.windowWidth ?? (showSidebar ? 960 : 720));
    }
    if (next.zoom !== undefined) {
      clearTimeout(zoomTimer.current); pendingZoom.current = undefined;
      setZoomDraft(next.zoom);
    }
    if (next.windowHeight !== undefined) {
      clearTimeout(heightTimer.current); pendingHeight.current = undefined;
      setHeightDraft(next.windowHeight);
    }
    setPrefs(previous => ({ ...previous, ...next }));
  };
  const changeZoomDraft = (zoom: number) => {
    setZoomDraft(zoom); pendingZoom.current = zoom;
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      pendingZoom.current = undefined;
      setPrefs(previous => ({ ...previous, zoom }));
    }, 300);
  };
  const changeHeightDraft = (windowHeight: number) => {
    setHeightDraft(windowHeight); pendingHeight.current = windowHeight;
    clearTimeout(heightTimer.current);
    heightTimer.current = setTimeout(() => {
      pendingHeight.current = undefined;
      setPrefs(previous => ({ ...previous, windowHeight }));
    }, 300);
  };
  const changeWidthDraft = (windowWidth: number) => {
    setWidthDraft(windowWidth); pendingWidth.current = windowWidth;
    clearTimeout(widthTimer.current);
    widthTimer.current = setTimeout(() => {
      pendingWidth.current = undefined;
      setPrefs(previous => ({ ...previous, windowWidth }));
    }, 300);
  };

  const topicBadges = (post: Post) => <div className="post-topics">{post.topicIds.length ? post.topicIds.map(id => {
    const topic = communities.find(c => c.id === id) ?? post.topics.find(c => c.id === id);
    return <button key={id} className="topic-tag" onClick={event => { event.stopPropagation(); setSelected(null); setPage('首页'); setActiveCommunity(id); }}>{topic?.name ?? `社区 ${id}`}<ChevronRight size={11} /></button>;
  }) : <span className="topic-tag muted">未分类</span>}</div>;
  const actions = (post: Post) => <div className="post-actions">
    <button disabled={pendingLike === post.id} className={post.liked ? 'is-liked' : ''} aria-label={`${post.liked ? '取消点赞' : '点赞'} ${post.title}`} onClick={() => void likePost(post)}><ThumbsUp size={15} />{post.likes}</button>
    <button onClick={() => openPost(post)} aria-label={`查看评论 ${post.title}`}><MessageCircle size={16} />{post.comments}</button>
    <button className={bookmarks.includes(post.id) ? 'is-saved' : ''} aria-label={`${bookmarks.includes(post.id) ? '取消收藏' : '收藏'} ${post.title}`} aria-pressed={bookmarks.includes(post.id)} onClick={() => { toggle(post.id, bookmarks, setBookmarks); notify(bookmarks.includes(post.id) ? '已取消本地收藏' : '已保存到本地收藏'); }}><Bookmark size={15} /></button>
    <button className="post-more" aria-label={`更多操作 ${post.title}`} onClick={openFilter}><MoreHorizontal size={18} /></button>
  </div>;

  return <div className={`desktop-stage theme-${theme} ${prefs.animations ? '' : 'no-motion'} ${maximized ? 'is-maximized' : ''} ${desktop ? 'native-desktop' : ''}`}>
    {(closed || minimized) ? <div className="preview-rest"><img className="brand-mark" src="/branding/heybox-icon.png" alt="小黑盒盒图标" /><h2>{closed ? '窗口已关闭' : '已收起到任务栏'}</h2><p>当前为前端窗口演示</p><button className="primary-button" onClick={() => { setClosed(false); setMinimized(false); }}>重新打开社区</button></div> :
    <div className="desktop-window" style={windowStyle}>
      <div className="window-inner" style={{ width: frameWidth / fit, height: frameHeight / fit, transform: `scale(${fit})` }}>
        <header className="titlebar" onMouseDown={event => {
          if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('button, a, input, textarea, select, [role="button"], [contenteditable], .titlebar-search, .page-dropdown')) return;
          void windowAction('drag').catch(error => notify(errorOf(error).message));
        }}>
          <div className="page-menu-wrap"><button className={`page-menu ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="切换页面"><span>{page}</span><ChevronDown size={15} /></button>
            {menu && <><button className="menu-dismiss" tabIndex={-1} aria-label="收起菜单" onClick={() => setMenu(false)} /><nav className="page-dropdown">{([{ name: '首页', icon: Home }, { name: '我的收藏', icon: Bookmark }, { name: '浏览记录', icon: PanelTop }] as const).map(item => <button key={item.name} className={page === item.name ? 'selected' : ''} onClick={() => goPage(item.name)}><item.icon size={16} />{item.name}{page === item.name && <Check size={14} />}</button>)}</nav></>}
          </div>
          <div className="titlebar-search"><Search size={14} /><input ref={searchRef} aria-label="搜索帖子或社区" placeholder="搜索帖子、社区" value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} />{search ? <button aria-label="清空搜索" onClick={() => setSearch('')}><X size={13} /></button> : <kbd>{prefs.shortcuts ? shortcutLabel(keybindings.search) : ''}</kbd>}</div>
          <div className="titlebar-right"><button className="icon-button" title="设置" aria-label="设置" onClick={() => setModal('settings')}><Settings size={18} /></button><button className="icon-button" title="用户" aria-label="用户" onClick={() => setModal('user')}>{account?.avatarUrl ? <img className="titlebar-avatar" src={account.avatarUrl} alt="当前用户头像" referrerPolicy="no-referrer" /> : <User size={18} />}</button><span className="titlebar-divider" /><button className="window-control" title="最小化" aria-label="最小化" onClick={() => desktop ? void windowAction('minimize').catch(error => notify(errorOf(error).message)) : setMinimized(true)}><Minus size={17} /></button><button className="window-control" title={maximized ? '还原窗口' : '最大化'} aria-label={maximized ? '还原窗口' : '最大化'} onClick={async () => { try { if (desktop) await windowAction('maximize'); setMaximized(previous => !previous); } catch (error) { notify(errorOf(error).message); } }}><Maximize2 size={13} /></button><button className="window-control close-control" title="关闭" aria-label="关闭窗口" onClick={() => desktop ? void closeWindow() : prefs.exit === 'tray' ? setMinimized(true) : setClosed(true)}><X size={18} /></button></div>
        </header>

        <div className="content-scroll" ref={contentRef}>
          <main className={`main-layout ${showSidebar ? '' : 'sidebar-hidden'}`}>
            <section className="feed-column">
              {selected ? <div className="post-detail">
                <div className="detail-toolbar"><button className="back-button" onClick={leavePost}><ArrowLeft size={16} />返回</button></div>
                <button className="author-line detail-author" aria-label={`查看 ${selected.author} 的主页`} onClick={() => void showProfile(selected)}><Avatar post={selected} /><div><strong>{selected.author}<Badges post={selected} /></strong><small>{postTime(selected)}</small></div></button>
                <h1><RichText text={selected.title} /></h1>{topicBadges(selected)}
                {detailLoading && !comments.length && <p className="loading-state" role="status">正在读取帖子与评论…</p>}
                {detailError && !comments.length && <ErrorNotice error={detailError} retry={() => void requestDetail(selected.id, failedDetailPage.current)} login={() => setModal('user')} />}
                <div className="post-body">{selected.body.map((p,index) => <p key={index}><RichText text={p} /></p>)}{selected.images.map((src, index) => <button className="detail-image" key={src} aria-label={`查看正文图片 ${index + 1}`} onClick={() => setImage(src)}><img src={src} alt={`${selected.title} 图片 ${index + 1}`} referrerPolicy="no-referrer" /></button>)}{selected.videoUrl && <video controls preload="none" src={selected.videoUrl} />}</div>
                {actions(selected)}<div className="comments-heading" ref={commentsRef}><h3>评论</h3><span>{selected.comments}</span><span className="comment-sort">热门评论</span></div>
                {comments.map(comment => <CommentThread key={`${selected.id}:${comment.id}`} comment={comment} onReply={c => { setReplyTarget(c); document.getElementById('reply-input')?.focus(); }} onProfile={c => showPersonProfile(c.userId, c.author, c.avatarUrl, c.level)} onLogin={() => setModal('user')} />)}
                {!detailLoading && !detailError && !comments.length && <p className="loading-state">还没有评论</p>}
                {detailError && comments.length > 0 && <ErrorNotice error={detailError} retry={() => void requestDetail(selected.id, failedDetailPage.current)} login={() => setModal('user')} />}
                {moreComments && !detailError && <div className="feed-end comments-end" ref={commentsEndRef} role="status">{detailLoading ? '正在加载更多评论…' : '继续下滑加载更多评论'}</div>}
                <form className="reply-form" onSubmit={event => { event.preventDefault(); void submitComment(); }}>
                  {replyTarget && <div className="reply-target">回复 @{replyTarget.author}<button type="button" onClick={() => setReplyTarget(null)}><X size={12} /></button></div>}
                  <textarea ref={replyRef} onSelect={e => { replySelection.current = {start:e.currentTarget.selectionStart,end:e.currentTarget.selectionEnd}; }} id="reply-input" aria-label="评论内容" placeholder={account ? '说说你的想法…' : '扫码登录后参与讨论'} maxLength={5000} value={reply} onChange={e => setReply(e.target.value)} />
                  <div className="reply-toolbar"><button type="button" className="emoji-toggle" aria-label="选择表情" aria-expanded={emojiPicker} onClick={() => setEmojiPicker(!emojiPicker)}><Smile size={18} /></button><span>{account ? '评论将发送到小黑盒' : '登录后才能评论'}</span><button className="primary-button" disabled={!reply.trim() || sending || !!detailError || detailLoading} type="submit">{sending ? '发送中…' : '评论'}</button></div>
                  {emojiPicker && <EmojiPicker onSelect={token => { const {start,end} = replySelection.current; const from = Math.min(start,reply.length), to = Math.min(end,reply.length); const next=reply.slice(0,from)+token+reply.slice(to); if (next.length > 5000) { notify('评论最多输入 5000 个字符'); return; } setReply(next); const caret=from+token.length; replySelection.current={start:caret,end:caret}; requestAnimationFrame(()=>{ replyRef.current?.focus(); replyRef.current?.setSelectionRange(caret,caret); }); }} />}
                </form>
              </div> : <>
                {page !== '首页' && <div className="feed-heading"><h2>{page}<span>{visiblePosts.length}</span></h2></div>}
                {page === '首页' && <nav className="community-ribbon" aria-label="社区分区">{homeCommunities.map(c => <button key={c.id} className={activeCommunity === c.id ? 'active' : ''} onClick={() => { setActiveCommunity(activeCommunity === c.id ? null : c.id); }}><CommunityIcon community={c} /><span>{c.name}</span></button>)}<button className="home-community-manage" aria-label="调整首页社区" title="编辑首页分区" onClick={() => { setSettingsTab('首页社区'); setModal('settings'); }}><PencilLine size={15} /></button></nav>}
                {activeCommunity && <div className="active-community"><span>正在浏览：<strong>{communities.find(c => c.id === activeCommunity)?.name}</strong></span><button onClick={() => setActiveCommunity(null)}><X size={13} />返回全部</button></div>}
                {search && <div className="search-summary">“{search}” 的搜索结果 <span>{visiblePosts.length} 篇</span></div>}
                {feed.loading && !posts.length && <div className="loading-state" role="status">正在读取小黑盒社区…</div>}
                {feed.error && !posts.length && <ErrorNotice error={feed.error} retry={feed.reload} login={() => setModal('user')} />}
                <div className="post-list">{visiblePosts.map(post => <article className="post-card" key={post.id} onClick={event => { if (!(event.target as Element).closest('button, a, input, textarea, select, [role="button"]')) openPost(post); }}><button className="post-content" onClick={() => openPost(post)}><h2><RichText text={post.title} /></h2><p><RichText text={post.excerpt} /></p></button>{post.images.length > 0 && <div className={`post-images ${post.images.length === 1 ? 'single-image' : ''}`}>{post.images.slice(0, 3).map((src, index) => <button key={src} onClick={() => setImage(src)} aria-label={`查看 ${post.title} 的图片 ${index + 1}`}><img src={src} alt={`${post.title} 配图 ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" /><span><Maximize2 size={14} /></span>{index === 2 && post.images.length > 3 && <span className="image-count">共{post.images.length}张</span>}</button>)}</div>}<div className="post-footer"><button className="author-line post-author" aria-label={`查看 ${post.author} 的资料`} onClick={() => void showProfile(post)}><Avatar post={post} /><div><strong><span className="author-name">{post.author}</span><Badges post={post} /></strong><small>{postTime(post)}{post.kind && <><span className="meta-dot">·</span>{post.kind}</>}</small></div></button><div className="post-footer-right">{topicBadges(post)}{actions(post)}</div></div></article>)}</div>
                {!feed.loading && !feed.error && !feed.hasMore && !visiblePosts.length && <div className="empty-state"><Search size={30} strokeWidth={1.3} /><h3>{page === '我的收藏' ? '把喜欢的帖子留在这里' : page === '浏览记录' ? '还没有浏览记录' : '没有符合条件的帖子'}</h3><p>{page === '我的收藏' ? '点击帖子下方的收藏，下次随时回来看看。' : page === '浏览记录' ? '打开一篇帖子后，会在这里留下记录。' : '换个搜索词，或在设置中检查社区与关键词屏蔽。'}</p><button className="secondary-button" onClick={() => page === '首页' ? (setSearch(''), setActiveCommunity(null)) : goPage('首页')}>{page === '首页' ? '返回推荐' : '去首页看看'}</button></div>}
                {feed.error && posts.length > 0 && <ErrorNotice error={feed.error} retry={() => void feed.loadMore()} login={() => setModal('user')} />}
                {page === '首页' && feed.hasMore && !feed.error && <div className="feed-end" ref={feedEndRef} role="status">{feed.loading ? '正在加载更多…' : '继续下滑加载更多'}</div>}{visiblePosts.length > 0 && !feed.hasMore && <div className="feed-end"><span />暂时看到这里<span /></div>}
              </>}
            </section>
            {showSidebar && <aside className="sidebar"><section className="community-panel"><div className="sidebar-heading"><h3>我的社区</h3><button onClick={openFilter} aria-label="管理屏蔽社区"><SlidersHorizontal size={15} /></button></div><div className="community-list">{communities.slice(0, 6).map(c => <button className={`${activeCommunity === c.id ? 'active' : ''} ${filter.mode === 'exclude' && filter.excluded.includes(c.id) ? 'community-blocked' : ''}`} key={c.id} onClick={() => { setSelected(null); setPage('首页'); setActiveCommunity(activeCommunity === c.id ? null : c.id); }}><CommunityIcon community={c} /><span>{c.name}<small>{filter.mode === 'exclude' && filter.excluded.includes(c.id) ? '已屏蔽' : c.members}</small></span><ChevronRight size={13} /></button>)}</div><button className="all-communities" onClick={openFilter}>屏蔽社区<ChevronRight size={13} /></button></section><div className="sidebar-footer"><span>第三方社区客户端</span><button onClick={() => { setSettingsTab('关于'); setModal('settings'); }}>关于</button></div></aside>}
          </main>
        </div>
        {page === '首页' && !selected && <button className="refresh-control" aria-label="刷新推荐内容" title="刷新推荐内容" disabled={feed.loading} onClick={refreshRecommendations}><RefreshCw size={19} className={feed.loading ? 'is-spinning' : ''} /></button>}
        {selected && <div className="detail-navigation">
          <button aria-label="回到顶部" title="回到顶部" onClick={() => scrollDetail(false)}><ArrowUpToLine size={19} /></button>
          <button aria-label="跳到评论区" title="跳到评论区" onClick={() => scrollDetail(true)}><MessageCircle size={19} /></button>
        </div>}
        <button className="zoom-control" aria-label="调整窗口缩放" title="调整窗口缩放" onClick={() => { setSettingsTab('外观'); setModal('settings'); }}>{prefs.zoom}%<ChevronsUpDown size={11} /></button>


        {modal === 'settings' && <Modal wide title="设置" onClose={() => setModal(null)}><div className="settings-layout"><nav className="settings-nav">{[{ name: '外观', icon: Sun }, { name: '首页社区', icon: Home }, { name: '屏蔽社区', icon: SlidersHorizontal }, { name: '关键词屏蔽', icon: TextSearch }, { name: '退出方式', icon: PanelTop }, { name: '快捷键', icon: ChevronsUpDown }, { name: '关于', icon: CircleHelp }].map(item => <button className={settingsTab === item.name ? 'active' : ''} key={item.name} onClick={() => setSettingsTab(item.name)}><item.icon size={15} />{item.name}</button>)}</nav><div className="settings-content">{settingsTab === '外观' && <><h3>主题</h3><div className="theme-options">{([{ value: 'light', text: '浅色', icon: Sun }, { value: 'dark', text: '深色', icon: Moon }, { value: 'system', text: '跟随系统', icon: PanelTop }] as const).map(item => <button key={item.value} className={prefs.theme === item.value ? 'active' : ''} onClick={() => patchPrefs({ theme: item.value })}><item.icon size={18} />{item.text}</button>)}</div><h3 className="setting-section-title">窗口缩放 <span>{zoomDraft}%</span></h3><p className="setting-description">调整窗口和界面比例，适合不同大小的屏幕。</p><input aria-label="窗口缩放" className="scale-slider" type="range" min="50" max="300" step="10" value={zoomDraft} onChange={e => changeZoomDraft(Number(e.target.value))} /><div className="scale-presets">{[50, 75, 100, 125, 150, 200, 300].map(value => <button key={value} className={zoomDraft === value ? 'active' : ''} onClick={() => patchPrefs({ zoom: value })}>{value}%</button>)}</div><div className="window-width-setting"><h3 className="setting-section-title">窗口宽度 <span>{widthDraft}px</span></h3><p className="setting-description">独立调整横向空间，宽度随窗口缩放变化。恢复默认后会根据右侧栏自动调整。</p><input aria-label="窗口宽度" className="scale-slider" type="range" min="600" max="1600" step="20" value={widthDraft} onChange={e => changeWidthDraft(Number(e.target.value))} /><div className="scale-presets">{[720, 800, 960, 1280, 1600].map(value => <button key={value} className={widthDraft === value ? 'active' : ''} onClick={() => patchPrefs({ windowWidth: value })}>{value}px</button>)}<button onClick={() => patchPrefs({ windowWidth: undefined })}>恢复默认宽度</button></div></div><h3 className="setting-section-title">窗口高度 <span>{heightDraft}px</span></h3><p className="setting-description">调整窗口纵向空间。高度随窗口缩放变化，超出屏幕时自动适配。</p><input aria-label="窗口高度" className="scale-slider" type="range" min="480" max="1200" step="20" value={heightDraft} onChange={e => changeHeightDraft(Number(e.target.value))} /><div className="scale-presets">{[600, 760, 900, 1080, 1200].map(value => <button key={value} className={heightDraft === value ? 'active' : ''} onClick={() => patchPrefs({ windowHeight: value })}>{value}px{value === 760 ? '（默认）' : ''}</button>)}</div><div className="setting-row"><div><strong>显示右侧栏</strong><small>显示我的社区列表</small></div><button className={`switch ${showSidebar ? 'on' : ''}`} role="switch" aria-label="显示右侧栏" aria-checked={showSidebar} onClick={() => patchPrefs({ showSidebar: !showSidebar })}><span /></button></div><div className="setting-row"><div><strong>动画效果</strong><small>菜单与弹窗使用轻量过渡</small></div><button className={`switch ${prefs.animations ? 'on' : ''}`} role="switch" aria-label="动画效果" aria-checked={prefs.animations} onClick={() => patchPrefs({ animations: !prefs.animations })}><span /></button></div></>}{settingsTab === '关键词屏蔽' && <BlockedKeywordsEditor keywords={blockedKeywords} onChange={setBlockedKeywords} />}{settingsTab === '屏蔽社区' && <><BlockedCommunitiesEditor excluded={filter.excluded} catalog={communities} onChange={excluded => setFilter({ mode: 'exclude', included: [], excluded, unknown: true })} />{communitiesError && <ErrorNotice error={communitiesError} retry={() => setOnlineRefresh(n => n + 1)} />}</>}{settingsTab === '首页社区' && <><HomeCommunitiesEditor value={fixedHomeCommunities} catalog={communities} onChange={setHomeCommunities} onReset={() => setHomeCommunities(null)} />{communitiesError && <ErrorNotice error={communitiesError} retry={() => setOnlineRefresh(n => n + 1)} />}</>}{settingsTab === '退出方式' && <><h3>点击关闭按钮时</h3><label className="radio-option"><input type="radio" name="exit" checked={prefs.exit === 'close'} onChange={() => patchPrefs({ exit: 'close' })} /><div><strong>退出应用</strong><small>关闭社区窗口</small></div></label><label className="radio-option"><input type="radio" name="exit" checked={prefs.exit === 'tray'} onChange={() => patchPrefs({ exit: 'tray' })} /><div><strong>收起到系统托盘</strong><small>保留窗口状态，随时继续浏览</small></div></label><p className="setting-description">桌面端可收起到系统托盘，从托盘菜单重新打开。</p></>}{settingsTab === '快捷键' && <><div className="setting-row"><div><strong>启用快捷键</strong><small>输入评论或编辑内容时自动停用</small></div><button className={`switch ${prefs.shortcuts ? 'on' : ''}`} role="switch" aria-label="启用快捷键" aria-checked={prefs.shortcuts} onClick={() => patchPrefs({ shortcuts: !prefs.shortcuts })}><span /></button></div><ShortcutsEditor bindings={keybindings} enabled={prefs.shortcuts} onChange={keybindings => patchPrefs({ keybindings })} /></>}{settingsTab === '关于' && <div className="about-panel"><img className="box-logo large-logo" src="/branding/heybox-icon.png" alt="小黑盒盒图标" /><h3>小黑盒盒</h3><p>Windows 第三方社区客户端</p><span className="version-pill">0.1.0</span><p className="about-description">浏览、交流，发现喜欢的游戏。<br />已接入真实社区，支持扫码登录。收藏保存在本机。</p><button className="text-button" onClick={() => void openOfficial('https://xiaoheihe.cn/app/bbs/home')}>前往官方社区<ExternalLink size={12} /></button>{dataDirectory && <small className="data-directory">数据目录：{dataDirectory}</small>}</div>}</div></div><div className="settings-bottom">{storageError || homeCommunitiesError || filterStorageError || keywordsStorageError ? '设置保存失败，请重试' : '设置自动保存'}<button className="primary-button" onClick={() => setModal(null)}>完成</button></div></Modal>}

        {modal === 'user' && <Modal title="你的社区账号" onClose={() => setModal(null)}><LoginPanel account={account} onAccount={loginChanged} notify={notify} /></Modal>}
        {profile && <Modal title="盒友主页" wide onClose={() => setProfile(null)}><UserHome key={profile.id} initial={profile} onOpenPost={post => { setProfile(null); openPost(post); postOriginProfile.current = profile; }} onLogin={() => { setProfile(null); setModal('user'); }} /></Modal>}

        {image && <Modal title="查看图片" wide onClose={() => setImage(null)}><img className="lightbox-image" src={image} alt="帖子配图大图" referrerPolicy="no-referrer" /></Modal>}
        {notice && <div className="toast" role="status"><Check size={15} />{notice}</div>}
      </div>
    </div>}
  </div>;
}
