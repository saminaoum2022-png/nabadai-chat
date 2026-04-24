let fabricLoadPromise = null;
let bgRemovalLoadPromise = null;
let cocoLoadPromise = null;
let tesseractLoadPromise = null;

export function loadFabricJsIfNeeded() {
  if (window.fabric) return Promise.resolve(window.fabric);
  if (fabricLoadPromise) return fabricLoadPromise;
  fabricLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js';
    script.async = true;
    script.onload = () => resolve(window.fabric);
    script.onerror = () => reject(new Error('Failed to load Fabric.js'));
    document.head.appendChild(script);
  });
  return fabricLoadPromise;
}

export async function loadBackgroundRemovalIfNeeded() {
  if (window.__NABAD_BG_REMOVAL__?.removeBackground) {
    return window.__NABAD_BG_REMOVAL__.removeBackground;
  }
  if (!bgRemovalLoadPromise) {
    const candidates = [
      'https://esm.sh/@imgly/background-removal?bundle',
      'https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm',
      'https://unpkg.com/@imgly/background-removal?module'
    ];
    bgRemovalLoadPromise = (async () => {
      let lastErr = null;
      for (const url of candidates) {
        try {
          const mod = await import(url);
          const removeBackgroundFn =
            mod?.removeBackground ||
            mod?.default?.removeBackground ||
            mod?.default;
          if (typeof removeBackgroundFn !== 'function') {
            throw new Error('removeBackground() missing');
          }
          window.__NABAD_BG_REMOVAL__ = { removeBackground: removeBackgroundFn };
          return removeBackgroundFn;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Failed to load background removal module.');
    })();
  }
  return bgRemovalLoadPromise;
}

export async function loadCocoSsd() {
  if (window.__NABAD_COCO_SSD__?.detect) return window.__NABAD_COCO_SSD__;
  if (!cocoLoadPromise) {
    cocoLoadPromise = (async () => {
      const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.21.0/dist/tf.min.js');
      if (!tf?.ready) throw new Error('TensorFlow.js not loaded');
      await tf.ready();
      const coco = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.esm.min.js');
      const model = await coco.load();
      window.__NABAD_COCO_SSD__ = model;
      return model;
    })();
  }
  return cocoLoadPromise;
}

export async function loadTesseract() {
  if (window.Tesseract?.recognize) return window.Tesseract;
  if (!tesseractLoadPromise) {
    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Tesseract?.recognize) resolve(window.Tesseract);
        else reject(new Error('Tesseract did not initialize.'));
      };
      script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(script);
    });
  }
  return tesseractLoadPromise;
}
