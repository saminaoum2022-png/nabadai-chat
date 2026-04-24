import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
  }
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const vapidEmail = process.env.VAPID_EMAIL;
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidEmail || !vapidPublic || !vapidPrivate) {
      return res.status(500).json({
        error: 'Missing VAPID env vars',
        detail: 'Set VAPID_EMAIL, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY'
      });
    }

    webpush.setVapidDetails(
      `mailto:${vapidEmail}`,
      vapidPublic,
      vapidPrivate
    );

    const { subscription, title, body, saveOnly } = req.body || {};
    if (!subscription) return res.status(400).json({ error: 'No subscription provided' });

    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const auth = String(subscription?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    const supabase = getSupabaseAdmin();

    // ── Save subscription to Supabase ──
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        { endpoint, p256dh, auth },
        { onConflict: 'endpoint' }
      );
    if (upsertError) throw upsertError;

    // ── Send notification if not saveOnly ──
    let sent = false;
    if (!saveOnly) {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body })
      );
      sent = true;
    }

    return res.status(200).json({ success: true, saved: true, sent });
  } catch (err) {
    console.error('[NOTIFY ERROR]', err);
    return res.status(500).json({ error: 'Notification failed', detail: err?.message });
  }
}
