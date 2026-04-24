export function campaignBubbleHasActions(bubble) {
  return !!bubble?.querySelector?.('button[data-nabad-action="campaign-refine-text"]');
}

export function ensureCampaignTemplateStage(bubble, { escapeHtml } = {}) {
  if (!bubble || !campaignBubbleHasActions(bubble)) return null;
  let stage = bubble.querySelector('.nabad-campaign-template-stage');
  if (stage) return stage;

  const imageWrap = bubble.querySelector('.nabad-inline-image-wrap');
  const baseImg = imageWrap?.querySelector?.('img.nabad-bubble-img');
  if (!imageWrap || !baseImg || !baseImg.src) return null;

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');
  stage = document.createElement('div');
  stage.className = 'nabad-campaign-template-stage';
  stage.innerHTML = `
    <img class="nabad-campaign-template-bg" src="${baseImg.src}" alt="${esc(baseImg.alt || 'Campaign visual')}" />
    <div class="nabad-campaign-template-layer">
      <div class="nabad-campaign-template-text" data-field="headline" contenteditable="true" spellcheck="false">Your headline</div>
      <div class="nabad-campaign-template-text" data-field="subline" contenteditable="true" spellcheck="false">Your subtitle</div>
      <div class="nabad-campaign-template-text" data-field="cta" contenteditable="true" spellcheck="false">Start now</div>
      <img class="nabad-campaign-template-logo" alt="Campaign logo overlay" />
    </div>
  `;

  const hint = document.createElement('div');
  hint.className = 'nabad-campaign-template-hint';
  hint.textContent = 'Tip: click any text directly on the visual to edit it.';
  imageWrap.replaceWith(stage);
  stage.insertAdjacentElement('afterend', hint);
  return stage;
}

export function focusCampaignTextField(stage, field = 'headline') {
  if (!stage) return;
  const el = stage.querySelector(`.nabad-campaign-template-text[data-field="${field}"]`)
    || stage.querySelector('.nabad-campaign-template-text[data-field="headline"]');
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function applyLogoToCampaignStage(stage, imageDataUrl = '') {
  if (!stage || !imageDataUrl) return;
  const logo = stage.querySelector('.nabad-campaign-template-logo');
  if (!logo) return;
  logo.src = imageDataUrl;
  logo.style.display = 'block';
}
