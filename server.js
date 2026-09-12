import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = process.env.PORT || 3000;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

app.use(express.json());
app.use(express.static('public'));

function clientFor(req) {
  if (!url || !key) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.');
  return createClient(url, key, { global: { headers: { Authorization: req.headers.authorization || '' } } });
}

async function member(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const supabase = clientFor(req);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: 'Please sign in first.' }); return null; }
  return { supabase, user };
}

app.get('/api/health', (_, res) => res.json({ status: 'crystal-clear' }));

app.get('/api/dashboard', async (req, res) => {
  try {
    const auth = await member(req, res); if (!auth) return;
    const { supabase, user } = auth;
    const [profile, mail, listings, chat] = await Promise.all([
      supabase.from('profiles').select('display_name,balance').eq('id', user.id).single(),
      supabase.from('mail').select('*', { count: 'exact' }).eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('marketplace_items').select('*').eq('active', true).order('price'),
      supabase.from('chat_messages').select('id,body,created_at,profiles(display_name)').order('created_at', { ascending: false }).limit(30)
    ]);
    if (profile.error) throw profile.error;
    res.json({ profile: profile.data, mail: mail.data || [], unread: mail.count || 0, listings: listings.data || [], chat: (chat.data || []).reverse() });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/transfer', async (req, res) => {
  try {
    const auth = await member(req, res); if (!auth) return;
    const { recipient, amount, note } = req.body;
    const { error } = await auth.supabase.rpc('transfer_crystallines', { recipient_name: recipient, transfer_amount: Number(amount), transfer_note: note || null });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/purchase', async (req, res) => {
  try {
    const auth = await member(req, res); if (!auth) return;
    const { error } = await auth.supabase.rpc('buy_marketplace_item', { item_id: req.body.itemId });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/mail', async (req, res) => {
  try {
    const auth = await member(req, res); if (!auth) return;
    const { recipient, subject, body } = req.body;
    const { error } = await auth.supabase.rpc('send_crystal_mail', { recipient_name: recipient, message_subject: subject, message_body: body });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/chat', async (req, res) => {
  try {
    const auth = await member(req, res); if (!auth) return;
    const body = String(req.body.body || '').trim();
    if (!body || body.length > 500) throw new Error('Messages must be between 1 and 500 characters.');
    const { error } = await auth.supabase.from('chat_messages').insert({ author_id: auth.user.id, body });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.listen(port, '0.0.0.0', () => console.log(`Crystonia portal listening on ${port}`));
