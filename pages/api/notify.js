import webpush from 'web-push';//FIX
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
); 
webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subscription, title, body, saveOnly } = req.body;
    if (!subscription) return res.status(400).json({ error: 'No subscription provided' });

    // ── Save subscription to Supabase ──
    const { endpoint, keys } = subscription;
    await supabase
      .from('push_subscriptions')
      .upsert(
        { endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint' }
      );

    // ── Send notification if not saveOnly ──
    if (!saveOnly) {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body })
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[NOTIFY ERROR]', err?.message);
    return res.status(500).json({ error: 'Notification failed', detail: err?.message });
  }
}
