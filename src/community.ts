import type { Community } from './data';

export function mergeCommunities(primary: Community[], extra: Community[]): Community[] {
  const merged = new Map<number, Community>();
  for (const community of [...primary, ...extra]) {
    const existing = merged.get(community.id);
    merged.set(community.id, existing ? { ...existing, icon: existing.icon || community.icon } : community);
  }
  return [...merged.values()];
}

export function fillHomeCommunities(fixed: Community[], pool: Community[], seed: number): Community[] {
  const selected = mergeCommunities(fixed, []).slice(0, 7);
  const ids = new Set(selected.map(c => c.id));
  const rank = (id: number) => {
    let hash = seed;
    for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    return (hash ^ (hash >>> 16)) >>> 0;
  };
  const candidates = mergeCommunities(pool, []).filter(c => !ids.has(c.id));
  candidates.sort((a, b) => rank(a.id) - rank(b.id) || a.id - b.id);
  return [...selected, ...candidates.slice(0, 7 - selected.length)];
}
