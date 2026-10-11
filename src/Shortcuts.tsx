import { useState } from 'react';

export const shortcutActions = { search: '搜索帖子', settings: '打开设置', back: '返回', close: '关闭弹窗' };
export type ShortcutAction = keyof typeof shortcutActions;
export interface Shortcut { code: string; ctrl: boolean; alt: boolean; shift: boolean }
export type Keybindings = Record<ShortcutAction, Shortcut>;
export const defaultKeybindings: Keybindings = {
  search: { code: 'KeyK', ctrl: true, alt: false, shift: false },
  settings: { code: 'Comma', ctrl: true, alt: false, shift: false },
  back: { code: 'Escape', ctrl: false, alt: false, shift: false },
  close: { code: 'Escape', ctrl: false, alt: false, shift: false },
};
const labels: Record<string, string> = { Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`', Minus: '-', Equal: '=', Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', Enter: 'Enter', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Delete: 'Delete', Insert: 'Insert', Backspace: 'Backspace' };
export function validShortcut(binding: Shortcut): boolean {
  return !!binding && typeof binding.ctrl === 'boolean' && typeof binding.alt === 'boolean' && typeof binding.shift === 'boolean' && typeof binding.code === 'string' && (/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/.test(binding.code) || Object.hasOwn(labels, binding.code));
}
export function resolveKeybindings(saved?: Partial<Keybindings>): Keybindings {
  return Object.fromEntries((Object.keys(defaultKeybindings) as ShortcutAction[]).map(action => [action, saved?.[action] && validShortcut(saved[action]) ? saved[action] : defaultKeybindings[action]])) as Keybindings;
}
export function shortcutLabel(binding: Shortcut): string {
  return [binding.ctrl && 'Ctrl', binding.alt && 'Alt', binding.shift && 'Shift', labels[binding.code] ?? binding.code.replace(/^(Key|Digit)/, '')].filter(Boolean).join(' + ');
}
export function matchesShortcut(event: KeyboardEvent, binding: Shortcut): boolean {
  return !event.metaKey && !event.isComposing && event.code === binding.code && event.ctrlKey === binding.ctrl && event.altKey === binding.alt && event.shiftKey === binding.shift;
}
export function ShortcutsEditor({ bindings, enabled, onChange }: { bindings: Keybindings; enabled: boolean; onChange: (next: Keybindings) => void }) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState('');
  return <><p className="setting-description">点击快捷键后按下新组合。返回与关闭弹窗可共用按键，默认均为 Esc；有弹窗时优先关闭弹窗。</p>
    {(Object.keys(shortcutActions) as ShortcutAction[]).map(action => <div className="shortcut-row" key={action}><span>{shortcutActions[action]}</span><button disabled={!enabled} className={`shortcut-binding ${recording === action ? 'recording' : ''}`} aria-label={`修改${shortcutActions[action]}快捷键`} onClick={() => { setRecording(action); setError(''); }} onBlur={() => setRecording(null)} onKeyDown={event => {
      if (recording !== action) return;
      event.preventDefault(); event.stopPropagation();
      if (event.nativeEvent.isComposing || event.repeat) return;
      const navigationAction = action === 'back' || action === 'close';
      if (event.code === 'Escape' && !navigationAction) { setRecording(null); setError(''); return; }
      if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
      const next = { code: event.code, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey };
      const plainEscape = navigationAction && next.code === 'Escape' && !next.ctrl && !next.alt && !next.shift;
      if (event.metaKey || !validShortcut(next) || (!plainEscape && !next.ctrl && !next.alt && !/^F\d+$/.test(next.code))) { setError('请使用 Ctrl / Alt 组合键或功能键，返回与关闭弹窗也可使用 Esc。'); return; }
      if ((next.alt && next.code === 'F4') || ['F5', 'F11', 'F12'].includes(next.code) || (next.ctrl && !next.alt && ['KeyW','KeyR','KeyL','KeyT','KeyN','KeyP','Space'].includes(next.code))) { setError('该组合由窗口、浏览器或输入法使用，请换一个。'); return; }
      const duplicate = (Object.keys(bindings) as ShortcutAction[]).find(other => other !== action && !(navigationAction && (other === 'back' || other === 'close')) && shortcutLabel(bindings[other]) === shortcutLabel(next));
      if (duplicate) { setError(`已用于“${shortcutActions[duplicate]}”，请换一个。`); return; }
      onChange({ ...bindings, [action]: next }); setRecording(null); setError('');
    }}><kbd>{recording === action ? '请按新快捷键…' : shortcutLabel(bindings[action])}</kbd></button></div>)}
    {error && <p className="shortcut-error" role="alert">{error}</p>}
    {recording && <button className="text-button shortcut-reset" onMouseDown={event => event.preventDefault()} onClick={() => { setRecording(null); setError(''); }}>取消录入</button>}
    <button className="text-button shortcut-reset" onClick={() => { onChange(defaultKeybindings); setRecording(null); setError(''); }}>恢复默认快捷键</button>
  </>;
}
