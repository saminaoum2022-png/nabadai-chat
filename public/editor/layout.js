export function hideChatForEditorMode(refs) {
  try {
    window.dispatchEvent(new CustomEvent('nabad:editor-mode', { detail: { open: true } }));
  } catch {}
  if (refs?.header) refs.header.style.display = 'none';
  const inputWrap = document.getElementById('nabad-input-wrap');
  if (inputWrap) inputWrap.style.display = 'none';
}

export function restoreChatAfterEditorMode(refs, { renderInitialState, scrollToBottom } = {}) {
  try {
    window.dispatchEvent(new CustomEvent('nabad:editor-mode', { detail: { open: false } }));
  } catch {}
  if (refs?.header) refs.header.style.display = '';
  const inputWrap = document.getElementById('nabad-input-wrap');
  if (inputWrap) inputWrap.style.display = 'flex';
  if (typeof renderInitialState === 'function') renderInitialState();
  if (typeof scrollToBottom === 'function') scrollToBottom();
}

export function makeRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function toHexColor(color = '#ffffff') {
  const value = String(color || '').trim();
  if (!value) return '#ffffff';
  if (value.startsWith('#')) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
    }
    return value.toLowerCase();
  }
  const m = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return '#ffffff';
  const to2 = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`.toLowerCase();
}
