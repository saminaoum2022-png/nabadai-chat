import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';

const PERSONALITIES = [
  { id: 'strategist', label: 'Strategist' },
  { id: 'growth', label: 'Growth' },
  { id: 'branding', label: 'Branding' },
  { id: 'offer', label: 'Offer' },
  { id: 'creative', label: 'Creative' },
  { id: 'straight_talk', label: 'Straight Talk' },
  { id: 'auto', label: 'Auto' }
];

export default function AppPage() {
  const [activePersonality, setActivePersonality] = useState('auto');
  const [imageProvider, setImageProvider] = useState('gemini');
  const [editorMode, setEditorMode] = useState(false);
  const [editorLayers, setEditorLayers] = useState({
    headline: true,
    subtext: true,
    cta: true,
    logo: true,
    background: true
  });
  const [editorSelection, setEditorSelection] = useState({ hasSelection: false });
  const [inspectorDraft, setInspectorDraft] = useState({
    fontFamily: 'Inter',
    fontSize: 34,
    color: '#ffffff',
    bold: false,
    italic: false,
    underline: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    opacity: 100
  });

  const providerOptions = useMemo(() => ([
    { id: 'auto', label: 'Let Nabad choose' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'nanobanana', label: 'Nano Banana (Gemini)' },
    { id: 'ideogram', label: 'Ideogram' },
    { id: 'replicate', label: 'Replicate' },
    { id: 'pollinations', label: 'Draft (Free)' }
  ]), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedPersonality = (localStorage.getItem('nabad_widget_v5:personality') || 'auto').toLowerCase();
      const savedProvider = (localStorage.getItem('nabad_widget_v5:imageProvider') || 'gemini').toLowerCase();
      setActivePersonality(PERSONALITIES.some((p) => p.id === savedPersonality) ? savedPersonality : 'auto');
      setImageProvider(providerOptions.some((p) => p.id === savedProvider) ? savedProvider : 'gemini');
    } catch {}
  }, [providerOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onEditorMode = (event) => {
      const open = !!event?.detail?.open;
      setEditorMode(open);
    };
    const onEditorLayers = (event) => {
      const d = event?.detail || {};
      setEditorLayers({
        headline: !!d.headline,
        subtext: !!d.subtext,
        cta: !!d.cta,
        logo: !!d.logo,
        background: !!d.background
      });
    };
    const onEditorSelection = (event) => {
      const d = event?.detail || {};
      setEditorSelection(d);
      if (d?.hasSelection) {
        setInspectorDraft({
          fontFamily: d.fontFamily || 'Inter',
          fontSize: Number(d.fontSize || 34),
          color: d.color || '#ffffff',
          bold: !!d.bold,
          italic: !!d.italic,
          underline: !!d.underline,
          x: Number(d.x || 0),
          y: Number(d.y || 0),
          w: Number(d.w || 0),
          h: Number(d.h || 0),
          opacity: Number(d.opacity || 100)
        });
      }
    };
    window.addEventListener('nabad:editor-mode', onEditorMode);
    window.addEventListener('nabad:editor-layers', onEditorLayers);
    window.addEventListener('nabad:editor-selection', onEditorSelection);
    return () => {
      window.removeEventListener('nabad:editor-mode', onEditorMode);
      window.removeEventListener('nabad:editor-layers', onEditorLayers);
      window.removeEventListener('nabad:editor-selection', onEditorSelection);
    };
  }, []);

  function applyPersonality(id) {
    const next = PERSONALITIES.some((p) => p.id === id) ? id : 'auto';
    setActivePersonality(next);
    if (window.__NABAD_SET_PERSONALITY__) window.__NABAD_SET_PERSONALITY__(next);
    if (window.__NABAD_BACK_TO_CHAT__) window.__NABAD_BACK_TO_CHAT__();
  }

  function applyProvider(id) {
    const next = providerOptions.some((p) => p.id === id) ? id : 'auto';
    setImageProvider(next);
    if (window.__NABAD_SET_IMAGE_PROVIDER__) window.__NABAD_SET_IMAGE_PROVIDER__(next);
  }

  function doEditorAction(action, payload) {
    if (window.__NABAD_EDITOR_DO__) {
      window.__NABAD_EDITOR_DO__(action, payload || {});
    }
  }

  function updateLayer(layer, visible) {
    setEditorLayers((prev) => ({ ...prev, [layer]: !!visible }));
    doEditorAction('set_layer_visibility', { layer, visible: !!visible });
  }

  function updateInspector(next) {
    const draft = { ...inspectorDraft, ...next };
    setInspectorDraft(draft);
    doEditorAction('set_selected_style', draft);
  }

  return (
    <>
      <Head>
        <title>NabadAi Desktop</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <Script id="nabad-widget-config-app" strategy="beforeInteractive">
        {`
          window.NABAD_WIDGET_CONFIG = {
            apiUrl: '/api/chat',
            title: 'NabadAi',
            subtitle: 'Business AI',
            inlineDesktop: true,
            mountSelector: '#nabad-desktop-chat',
            vapidPublicKey: '${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''}'
          };
        `}
      </Script>
      <Script id="nabad-widget-script-app" src="/widget.js?v=65" strategy="afterInteractive" />

      <main className="nabad-app-page">
        <div className={`nabad-app-shell ${editorMode ? 'editor-open' : ''}`}>
          <aside className="nabad-left-rail">
            <div className="nabad-brand">
              <img src="/logo.png" alt="Nabad" />
              <div>
                <h1>{editorMode ? 'Nabad Editor' : 'NabadAi'}</h1>
                <p>{editorMode ? 'Design Workspace' : 'Desktop Workspace'}</p>
              </div>
            </div>

            {!editorMode && (
              <section className="nabad-rail-card">
                <h3>Personality</h3>
                <div className="nabad-chip-grid">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`nabad-chip ${activePersonality === p.id ? 'active' : ''}`}
                      onClick={() => applyPersonality(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="nabad-rail-card">
              <h3>Image Engine</h3>
              <select
                className="nabad-select"
                value={imageProvider}
                onChange={(e) => applyProvider(e.target.value)}
              >
                {providerOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </section>

            {editorMode ? (
              <section className="nabad-rail-card">
                <h3>Editor Tools</h3>
                {!editorSelection?.hasSelection ? (
                  <>
                    <div className="nabad-subtitle">Layers</div>
                    <div className="nabad-layer-list">
                      <label><input type="checkbox" checked={editorLayers.headline} onChange={(e) => updateLayer('headline', e.target.checked)} /> 👁 Headline text</label>
                      <label><input type="checkbox" checked={editorLayers.subtext} onChange={(e) => updateLayer('subtext', e.target.checked)} /> 👁 Subtext</label>
                      <label><input type="checkbox" checked={editorLayers.cta} onChange={(e) => updateLayer('cta', e.target.checked)} /> 👁 CTA button</label>
                      <label><input type="checkbox" checked={editorLayers.logo} onChange={(e) => updateLayer('logo', e.target.checked)} /> 👁 Logo</label>
                      <label><input type="checkbox" checked={editorLayers.background} onChange={(e) => updateLayer('background', e.target.checked)} /> 👁 Background image</label>
                    </div>
                    <div className="nabad-subtitle" style={{ marginTop: 10 }}>Add</div>
                    <div className="nabad-actions">
                      <button type="button" onClick={() => doEditorAction('editor_add', { type: 'text' })}>+ Text</button>
                      <button type="button" onClick={() => doEditorAction('editor_add', { type: 'image' })}>+ Image</button>
                      <button type="button" onClick={() => doEditorAction('editor_add', { type: 'shape' })}>+ Shape</button>
                      <button type="button" onClick={() => doEditorAction('editor_add', { type: 'logo' })}>+ Logo</button>
                      <button type="button" onClick={() => doEditorAction('back_chat')}>Back to Chat</button>
                      <button type="button" onClick={() => doEditorAction('open_settings')}>Back to Settings</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="nabad-subtitle">Selected: {editorSelection?.label || 'Object'}</div>
                    <div className="nabad-inspector-grid">
                      <label>Font
                        <select value={inspectorDraft.fontFamily} onChange={(e) => updateInspector({ fontFamily: e.target.value })}>
                          <option value="Inter">Inter</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Merriweather">Merriweather</option>
                        </select>
                      </label>
                      <label>Size
                        <input type="range" min="10" max="160" value={inspectorDraft.fontSize} onChange={(e) => updateInspector({ fontSize: Number(e.target.value) })} />
                      </label>
                      <label>Color
                        <input type="color" value={inspectorDraft.color} onChange={(e) => updateInspector({ color: e.target.value })} />
                      </label>
                      <div className="nabad-inline-row">
                        <button type="button" className={inspectorDraft.bold ? 'active' : ''} onClick={() => updateInspector({ bold: !inspectorDraft.bold })}>B</button>
                        <button type="button" className={inspectorDraft.italic ? 'active' : ''} onClick={() => updateInspector({ italic: !inspectorDraft.italic })}>I</button>
                        <button type="button" className={inspectorDraft.underline ? 'active' : ''} onClick={() => updateInspector({ underline: !inspectorDraft.underline })}>U</button>
                      </div>
                      <label>X<input type="number" value={inspectorDraft.x} onChange={(e) => updateInspector({ x: Number(e.target.value) })} /></label>
                      <label>Y<input type="number" value={inspectorDraft.y} onChange={(e) => updateInspector({ y: Number(e.target.value) })} /></label>
                      <label>W<input type="number" value={inspectorDraft.w} onChange={(e) => updateInspector({ w: Number(e.target.value) })} /></label>
                      <label>H<input type="number" value={inspectorDraft.h} onChange={(e) => updateInspector({ h: Number(e.target.value) })} /></label>
                      <label>Opacity
                        <input type="range" min="0" max="100" value={inspectorDraft.opacity} onChange={(e) => updateInspector({ opacity: Number(e.target.value) })} />
                      </label>
                      <button type="button" onClick={() => doEditorAction('delete_selected')}>Delete element</button>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <section className="nabad-rail-card">
                <h3>Workspace</h3>
                <div className="nabad-actions">
                  <button type="button" onClick={() => window.__NABAD_OPEN_SETTINGS__?.()}>Settings</button>
                  <button type="button" onClick={() => window.__NABAD_OPEN_MEMORY__?.()}>Memory</button>
                  <button type="button" onClick={() => window.__NABAD_OPEN_PROFILE__?.()}>Profile</button>
                  <button type="button" onClick={() => window.__NABAD_OPEN_ACCOUNT__?.()}>Account</button>
                  <button type="button" onClick={() => window.__NABAD_NEW_CHAT__?.()}>New Chat</button>
                </div>
              </section>
            )}
          </aside>

          <section className="nabad-chat-stage">
            <div id="nabad-desktop-chat" className="nabad-chat-mount" />
          </section>
        </div>
      </main>

      <style jsx>{`
        .nabad-app-page {
          min-height: 100dvh;
          background:
            radial-gradient(1200px 500px at -10% -20%, rgba(14,116,255,.16), transparent 65%),
            radial-gradient(900px 460px at 110% -10%, rgba(6,182,212,.14), transparent 65%),
            linear-gradient(180deg, #edf5ff 0%, #f6faff 100%);
          padding: 18px;
          color: #0f172a;
          font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .nabad-app-shell {
          max-width: 1460px;
          margin: 0 auto;
          min-height: calc(100dvh - 36px);
          display: grid;
          grid-template-columns: 300px minmax(720px, 1fr);
          gap: 16px;
        }

        .nabad-left-rail {
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(37, 99, 235, 0.14);
          border-radius: 20px;
          padding: 16px;
          backdrop-filter: blur(8px);
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: sticky;
          top: 12px;
          height: calc(100dvh - 60px);
          overflow: auto;
        }

        .nabad-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 4px 10px;
        }

        .nabad-brand img {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 2px solid rgba(37, 99, 235, 0.22);
        }

        .nabad-brand h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .nabad-brand p {
          margin: 3px 0 0;
          color: #5b6b82;
          font-size: 12px;
          font-weight: 700;
        }

        .nabad-rail-card {
          background: rgba(255,255,255,.86);
          border: 1px solid rgba(37,99,235,.14);
          border-radius: 14px;
          padding: 12px;
        }

        .nabad-rail-card h3 {
          margin: 0 0 10px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #2563eb;
        }

        .nabad-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .nabad-chip {
          border: 1px solid rgba(37, 99, 235, 0.18);
          background: #fff;
          color: #1e3a8a;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 11px;
          cursor: pointer;
        }

        .nabad-chip.active {
          color: #fff;
          border-color: transparent;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
        }

        .nabad-select {
          width: 100%;
          border: 1px solid rgba(37,99,235,.18);
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          font-size: 13px;
          font-weight: 700;
          padding: 10px;
        }

        .nabad-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .nabad-subtitle {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #1e3a8a;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .nabad-layer-list {
          display: grid;
          gap: 8px;
        }
        .nabad-layer-list label {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(37,99,235,.16);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
          color: #1e3a8a;
          background: #fff;
          font-weight: 700;
        }
        .nabad-inspector-grid {
          display: grid;
          gap: 8px;
        }
        .nabad-inspector-grid label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #334155;
          font-weight: 700;
        }
        .nabad-inspector-grid input,
        .nabad-inspector-grid select,
        .nabad-inspector-grid button {
          border: 1px solid rgba(37,99,235,.16);
          border-radius: 10px;
          background: #fff;
          color: #1e3a8a;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
        }
        .nabad-inline-row {
          display: flex;
          gap: 6px;
        }
        .nabad-inline-row button {
          width: 34px;
          text-align: center;
          padding: 7px 0;
        }
        .nabad-inline-row button.active {
          color: #fff;
          border-color: transparent;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
        }

        .nabad-actions button {
          border: 1px solid rgba(37,99,235,.16);
          background: #fff;
          color: #1e3a8a;
          border-radius: 10px;
          padding: 10px 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .nabad-chat-stage {
          min-width: 0;
          background: rgba(255,255,255,.68);
          border: 1px solid rgba(37, 99, 235, 0.14);
          border-radius: 20px;
          padding: 12px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(8px);
        }

        .nabad-chat-mount {
          height: calc(100dvh - 62px);
          min-height: 680px;
        }

        @media (max-width: 1100px) {
          .nabad-app-shell {
            grid-template-columns: 1fr;
          }
          .nabad-left-rail {
            order: 2;
            position: static;
            height: auto;
            overflow: visible;
          }
          .nabad-chat-stage {
            order: 1;
          }
          .nabad-chat-mount {
            height: calc(100dvh - 220px);
            min-height: 560px;
          }
          .nabad-app-shell.editor-open .nabad-left-rail {
            display: none;
          }
          .nabad-app-shell.editor-open .nabad-chat-stage {
            padding: 8px;
            border-radius: 16px;
          }
          .nabad-app-shell.editor-open .nabad-chat-mount {
            height: calc(100dvh - 36px);
            min-height: 0;
          }
        }
      `}</style>
    </>
  );
}
