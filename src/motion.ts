import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

let running: ViewTransition | null = null;

// CSS already honours .no-motion and prefers-reduced-motion, but the View Transition
// pseudo-elements are not matched by those rules, so every JS-driven transition must
// check the preference itself.
export function motionAllowed(preference: boolean): boolean {
  return preference && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function hasViewTransition(): boolean {
  return typeof document.startViewTransition === 'function';
}

export function transitionRunning(): boolean {
  return running !== null;
}

export function viewTransition(
  preference: boolean,
  update: () => void,
  hooks?: { before?: () => void; afterUpdate?: () => void | Promise<void>; cleanup?: () => void },
): void {
  if (!motionAllowed(preference) || !hasViewTransition() || running) {
    update();
    return;
  }
  hooks?.before?.();
  const start = document.startViewTransition.bind(document);
  let transition: ViewTransition;
  try {
    transition = start(() => {
      // Layout effects (scroll restoration) must run before the new snapshot is taken.
      flushSync(update);
      // Returning a promise makes the browser wait before capturing the new state; this is how
      // we keep a freshly mounted picture from being snapshotted while still undecoded.
      return hooks?.afterUpdate?.();
    });
  } catch {
    hooks?.cleanup?.();
    update();
    return;
  }
  running = transition;
  const done = () => {
    if (running === transition) running = null;
    hooks?.cleanup?.();
  };
  transition.finished.then(done, done);
}

// Set view-transition-name on one element for the duration of a transition, then restore
// whatever inline value was there before (normally nothing).
export function pinTransitionName(target: Element | null | undefined, name: string): () => void {
  if (!(target instanceof HTMLElement)) return () => {};
  const previous = target.style.getPropertyValue('view-transition-name');
  target.style.setProperty('view-transition-name', name);
  return () => {
    if (previous) target.style.setProperty('view-transition-name', previous);
    else target.style.removeProperty('view-transition-name');
  };
}

// Wait for a freshly mounted <img> to decode before the new snapshot is taken, with a hard
// timeout so a slow network can never freeze the transition. Used by the shared-element morphs.
export async function settleImage(target: Element | null | undefined, timeoutMs = 320): Promise<void> {
  if (!(target instanceof HTMLImageElement)) return;
  const wait = (async () => {
    if (!target.complete) {
      await new Promise<void>(resolve => {
        target.addEventListener('load', () => resolve(), { once: true });
        target.addEventListener('error', () => resolve(), { once: true });
      });
    }
    try { await target.decode(); } catch { /* a broken image is handled by the component */ }
  })();
  await Promise.race([wait, new Promise<void>(resolve => setTimeout(resolve, timeoutMs))]);
}

// Keep an element mounted while its exit animation plays. Mounting stays in sync with
// `open` so opening never waits for an effect; exitMs is 0 when motion is disabled.
export function usePresence(open: boolean, exitMs = 140) {
  const [kept, setKept] = useState(false);
  useEffect(() => {
    if (open) { setKept(true); return; }
    if (!kept) return;
    const timer = setTimeout(() => setKept(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, kept, exitMs]);
  return { mounted: open || kept, closing: !open && kept };
}

// Delay skeleton states so fast, cached loads do not flash an empty placeholder.
export function useDelayedFlag(active: boolean, delayMs = 120): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) { setShown(false); return; }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return shown;
}
