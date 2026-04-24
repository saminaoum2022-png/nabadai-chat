export async function fetchCampaignEditorImage({
  apiUrl,
  promptText = '',
  imageProvider = 'auto',
  memoryKey = ''
}) {
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignAction: 'generate_image',
      campaignImagePrompt: promptText,
      imageProvider,
      memoryKey
    })
  });
  if (!resp.ok) throw new Error(`Campaign image generation failed (${resp.status})`);
  const data = await resp.json();
  if (!data?.campaignImageUrl) throw new Error('No campaign image URL returned');
  return {
    url: String(data.campaignImageUrl),
    provider: String(data.campaignImageProvider || '')
  };
}

export async function fetchCampaignRewriteCopy({
  apiUrl,
  copyContext = {},
  memoryKey = ''
}) {
  const payload = {
    campaignAction: 'rewrite_copy',
    campaignCopyContext: copyContext,
    memoryKey
  };
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(`Campaign copy rewrite failed (${resp.status})`);
  const data = await resp.json();
  return {
    headline: String(data?.campaignCopy?.headline || ''),
    subtext: String(data?.campaignCopy?.subtext || ''),
    ctaText: String(data?.campaignCopy?.ctaText || '')
  };
}
