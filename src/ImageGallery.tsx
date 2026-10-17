import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

function ExpandedImage({ src, alt, navigation }: { src: string; alt: string; navigation: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ imageX: number; imageY: number; viewportX: number; viewportY: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; screenScale: number } | null>(null);
  const suppressDoubleClickUntil = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<'fit' | 'actual' | 'custom'>('fit');
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setBounds({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const widthScale = size.width ? Math.min(1, Math.max(1, bounds.width - 32) / size.width) : 1;
  const fitScale = size.height ? Math.min(widthScale, Math.max(1, bounds.height - 32) / size.height) : 1;
  const scale = mode === 'fit' ? fitScale : mode === 'actual' ? 1 : zoom;
  const ready = state === 'ready' && bounds.width > 0;
  const selectMode = (next: typeof mode) => {
    anchor.current = null;
    setMode(next);
    if (viewport.current) {
      viewport.current.scrollTop = 0;
      viewport.current.scrollLeft = Math.max(0, (viewport.current.scrollWidth - viewport.current.clientWidth) / 2);
    }
  };

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const previous = anchor.current;
    const image = element.querySelector('img');
    if (previous && image) {
      const rect = element.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const screenScale = rect.width / element.offsetWidth;
      element.scrollLeft += (imageRect.left - rect.left) / screenScale + previous.imageX * scale - previous.viewportX;
      element.scrollTop += (imageRect.top - rect.top) / screenScale + previous.imageY * scale - previous.viewportY;
      anchor.current = null;
    } else {
      element.scrollTop = 0;
      element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
    }
  }, [scale, mode]);

  const changeZoom = (factor: number, point?: { x: number; y: number }) => {
    const element = viewport.current;
    const image = element?.querySelector('img');
    if (!element || !image || !ready) return;
    const next = Math.max(Math.min(0.1, fitScale), Math.min(4, scale * factor));
    if (next === scale) return;
    const rect = element.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const screenScale = rect.width / element.offsetWidth;
    const x = point?.x ?? rect.left + element.clientWidth * screenScale / 2;
    const y = point?.y ?? rect.top + element.clientHeight * screenScale / 2;
    anchor.current = {
      imageX: (x - imageRect.left) / imageRect.width * size.width,
      imageY: (y - imageRect.top) / imageRect.height * size.height,
      viewportX: (x - rect.left) / screenScale,
      viewportY: (y - rect.top) / screenScale,
    };
    setZoom(next);
    setMode('custom');
  };

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!ready) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      changeZoom(Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.002), { x: event.clientX, y: event.clientY });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !ready) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(1.25); }
      if (event.key === '-') { event.preventDefault(); changeZoom(0.8); }
      if (event.key === '0') { event.preventDefault(); selectMode('fit'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return <div className="expanded-image">
    <div className={`gallery-viewport${ready ? ' gallery-pannable' : ''}${dragging ? ' gallery-dragging' : ''}`} ref={viewport} tabIndex={0} role="region" aria-label="图片阅读区域，滚轮缩放，拖拽移动" aria-busy={state === 'loading'}
      onPointerDown={event => {
        if (!ready || event.button !== 0 || !event.isPrimary || !(event.target as HTMLElement).closest('.gallery-image-surface')) return;
        const element = event.currentTarget;
        suppressDoubleClickUntil.current = 0;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, screenScale: element.getBoundingClientRect().width / element.offsetWidth };
        element.setPointerCapture(event.pointerId);
        element.focus({ preventScroll: true });
        setDragging(true);
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = (event.clientX - current.x) / current.screenScale;
        const dy = (event.clientY - current.y) / current.screenScale;
        if (Math.hypot(dx, dy) > 4) suppressDoubleClickUntil.current = performance.now() + 300;
        event.currentTarget.scrollLeft = current.left - dx;
        event.currentTarget.scrollTop = current.top - dy;
      }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onDoubleClick={event => {
        if (ready && !(event.target as HTMLElement).closest('button') && performance.now() >= suppressDoubleClickUntil.current) selectMode(mode === 'actual' ? 'fit' : 'actual');
      }}>
      {state !== 'error' && <div className="gallery-image-surface" style={{ width: Math.max(bounds.width, size.width * scale + 32), height: Math.max(bounds.height, size.height * scale + 32) }}>
        <img key={attempt} src={src} alt={alt} referrerPolicy="no-referrer" draggable={false}
          style={{ width: size.width * scale || undefined, height: size.height * scale || undefined, visibility: ready ? 'visible' : 'hidden' }}
          onLoad={event => { setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setState('ready'); }}
          onError={() => setState('error')} />
      </div>}
      {state === 'loading' && <span className="gallery-loading" role="status">正在加载图片…</span>}
      {state === 'error' && <div className="gallery-error" role="alert"><span>图片加载失败</span><button onClick={() => { setState('loading'); setAttempt(value => value + 1); }}><RefreshCw size={14} />重试</button></div>}
    </div>
    <div className="gallery-view-footer">
      <span aria-hidden="true" />
      <div className="gallery-navigation">{navigation}</div>
      <div className="gallery-zoom-controls" role="group" aria-label="图片缩放">
        <button aria-label="缩小图片" title="缩小（−）" disabled={!ready || scale <= Math.min(0.1, fitScale)} onClick={() => changeZoom(0.8)}><ZoomOut size={16} /></button>
        <span aria-live="polite">{ready ? `${Math.round(scale * 100)}%` : '—'}</span>
        <button aria-label="放大图片" title="放大（+）" disabled={!ready || scale >= 4} onClick={() => changeZoom(1.25)}><ZoomIn size={16} /></button>
      </div>
    </div>
  </div>;
}

function GalleryImage({ src, alt, onOpen }: { src: string; alt: string; onOpen?: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const image = <img key={attempt} src={src} alt={alt} referrerPolicy="no-referrer" draggable={false} onLoad={() => setState('ready')} onError={() => setState('error')} />;
  return <>
    {state !== 'error' && (onOpen ? <button className="gallery-image" aria-label={`查看大图：${alt}`} onClick={onOpen}>{image}</button> : <div className="gallery-image">{image}</div>)}
    {state === 'loading' && <span className="gallery-loading" role="status">正在加载图片…</span>}
    {state === 'error' && <div className="gallery-error" role="alert"><span>图片加载失败</span><button onClick={() => { setState('loading'); setAttempt(value => value + 1); }}><RefreshCw size={14} />重试</button></div>}
  </>;
}

export function ImageGallery({ images, index, title, label = '帖子图片', onChange, onOpen, expanded = false }: {
  images: string[]; index: number; title: string; label?: string; onChange: (index: number) => void; onOpen?: () => void; expanded?: boolean;
}) {
  if (!images.length) return null;
  const current = Math.max(0, Math.min(index, images.length - 1));
  const navigation = <>
    {images.length > 1 && <button className="gallery-arrow gallery-previous" aria-label="上一张图片" title="上一张图片（←）" disabled={current === 0} onClick={() => onChange(current - 1)}><ChevronLeft size={22} /></button>}
    <span className="gallery-count" role="status" aria-live="polite" aria-atomic="true">{current + 1}/{images.length}</span>
    {images.length > 1 && <button className="gallery-arrow gallery-next" aria-label="下一张图片" title="下一张图片（→）" disabled={current === images.length - 1} onClick={() => onChange(current + 1)}><ChevronRight size={22} /></button>}
  </>;
  return <div className={`image-gallery ${expanded ? 'image-gallery-expanded' : ''}`} role="region" aria-label={label}>
    {expanded ? <ExpandedImage key={`${current}:${images[current]}`} src={images[current]} alt={`${title} 图片 ${current + 1}`} navigation={navigation} /> : <><GalleryImage key={images[current]} src={images[current]} alt={`${title} 图片 ${current + 1}`} onOpen={onOpen} />{navigation}</>}
  </div>;
}
