import type { ImgHTMLAttributes } from 'react';

// Images start transparent and fade in once decoded. The ref check covers cached images
// whose load event can fire before React attaches the handler.
function markLoaded(image: HTMLImageElement | null) {
  if (image?.complete && image.naturalWidth > 0) image.classList.add('is-loaded');
}

export function FadeImage({ className = '', onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} className={`fade-img ${className}`.trim()} ref={markLoaded}
    onLoad={event => { event.currentTarget.classList.add('is-loaded'); onLoad?.(event); }} />;
}
