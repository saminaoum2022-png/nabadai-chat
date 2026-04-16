import webpush from 'web-push';
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
  // Security check — only allow Vercel cron calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday

    // Only send at specific times (UTC+4 for UAE)
    // 7am UAE = 3am UTC
    const isMorning = hour === 3;
    // Monday 8am UAE = Monday 4am UTC
    const isMonday = day === 1 && hour === 4;

    if (!isMorning && !isMonday) {
      return res.status(200).json({ message: 'Not a notification time' });
    }

    // Get all subscriptions from Supabase
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) throw error;
    if (!subscriptions?.length) {
      return res.status(200).json({ message: 'No subscriptions found' });
    }

    // Build notification content
    let title, body;

    if (isMonday) {
      title = '📊 New week — new moves';
      body = 'What\'s the one thing that has to happen this week?';
    } else {
      // Morning notifications — rotate based on day
      const morningMessages = [
        { title: '☀️ Morning Brief ready', body: 'Your daily focus and market pulse are waiting.' },
        { title: '🔥 Good morning', body: 'What\'s the biggest move you can make today?' },
        { title: '⚡ Start strong', body: 'Open Nabad — your morning brief is ready.' },
        { title: '🎯 Focus time', body: 'What decision have you been avoiding? Let\'s tackle it.' },
        { title: '💡 Morning check-in', body: 'Nabad has your daily brief ready. Tap to see it.' },
        { title: '🚀 New day', body: 'What\'s keeping you up at night? Let\'s fix it today.' },
        { title: '📈 Daily brief', body: 'Your personalized morning insight is ready.' }
      ];
      const dayIndex = now.getUTCDay();
      const msg = morningMessages[dayIndex % morningMessages.length];
      title = msg.title;
      body = msg.body;
    }

    // Send to all subscribers
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify({ title, body })
        )
      )
    );

    // Clean up expired subscriptions
    const expired = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const status = result.reason?.statusCode;
        if (status === 404 || status === 410) {
          expired.push(subscriptions[i].endpoint);
        }
      }
    });

    if (expired.length) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired);
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return res.status(200).json({ success: true, sent, expired: expired.length });

  } catch (err) {
    console.error('[CRON ERROR]', err?.message);
    return res.status(500).json({ error: 'Cron failed', detail: err?.message });
  }
}
