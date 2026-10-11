import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Community, Post, Comment } from './data';

export const desktop = isTauri();
export interface ApiError { code: string; message: string; officialUrl?: string }
export interface Account { id: string; name: string; avatarUrl: string; level?: number; bio?: string }
export interface Cursor { offset: number; topics: Record<string, number>; exhausted: number[]; rotation: number }
export interface FeedPage { posts: Post[]; cursor: Cursor; hasMore: boolean }
export interface Detail { post: Post | null; comments: Comment[]; page: number; hasMore: boolean; isCy: boolean }
export interface Qr { session: string; svg: string; expiresAt: number }
export interface QrStatus { state: 'waiting' | 'scanned' | 'expired' | 'error' | 'success'; message?: string; account?: Account }
export interface Bootstrap { account: Account | null; states: Record<string, unknown>; dataDirectory: string }

export async function api<T>(type: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const request = payload === undefined ? { type } : { type, payload };
  try {
    if (desktop) return await invoke<T>('command', { request });
    const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Heybox-Client': 'desktop-preview' }, body: JSON.stringify(request), signal });
    if (!response.ok) throw { code: 'backend', message: '本地后端未连接，请启动后端后重试' };
    const result = await response.json();
    if (!result.ok) throw result.error;
    return result.data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error && typeof error === 'object' && 'message' in error && 'code' in error) throw error;
    throw { code: 'backend', message: '本地后端未连接，请启动后端后重试' } satisfies ApiError;
  }
}
export function errorOf(error: unknown): ApiError {
  return error && typeof error === 'object' && 'message' in error ? error as ApiError : { code: 'unknown', message: '请求失败，请重试' };
}
export async function windowAction(action: string, zoom?: number, showSidebar?: boolean, windowHeight?: number, windowWidth?: number) {
  if (desktop) return invoke('window_action', { action, zoom, showSidebar, windowHeight, windowWidth });
}
export async function openOfficial(url: string) {
  if (desktop) await invoke('open_official', { url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}
export const getCommunities = (query = '') => api<Community[]>('communities', { query });
