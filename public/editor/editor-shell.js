export function buildCampaignPreviewCard(data = {}, { cleanText, escapeHtml } = {}) {
  const clean = typeof cleanText === 'function'
    ? cleanText
    : (v, max = 220) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const esc = typeof escapeHtml === 'function'
    ? escapeHtml
    : (v) => String(v || '');

  const payload = encodeURIComponent(JSON.stringify({
    headline: clean(data.headline || '', 180),
    subtext: clean(data.subtext || '', 220),
    ctaText: clean(data.ctaText || '', 120),
    imagePrompt: clean(data.imagePrompt || '', 1200),
    objective: clean(data.objective || '', 200),
    audience: clean(data.audience || '', 180),
    offer: clean(data.offer || '', 220),
    tone: clean(data.tone || '', 90),
    visualStyle: clean(data.visualStyle || '', 140),
    platform: clean(data.platform || '', 80),
    format: clean(data.format || '', 80),
    typography: {
      fontFamily: clean(data?.typography?.fontFamily || '', 48),
      headlineSize: Number(data?.typography?.headlineSize || 0) || 0,
      subtextSize: Number(data?.typography?.subtextSize || 0) || 0,
      ctaSize: Number(data?.typography?.ctaSize || 0) || 0
    }
  }));

  return `<div class="nabad-campaign-preview-card" data-nabad-card="campaign-preview" data-campaign-payload="${payload}">
    <div class="nabad-campaign-preview-title">Campaign Draft</div>
    <div class="nabad-campaign-preview-row"><strong>Headline:</strong> ${esc(clean(data.headline || '', 180) || '—')}</div>
    <div class="nabad-campaign-preview-row"><strong>Subtext:</strong> ${esc(clean(data.subtext || '', 220) || '—')}</div>
    <div class="nabad-campaign-preview-row"><strong>CTA:</strong> ${esc(clean(data.ctaText || '', 120) || '—')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button data-nabad-action="campaign-open-editor">Open Editor</button>
    </div>
  </div>`;
}
