import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $ = s => document.querySelector(s);
const authDialog = $('#authDialog');
let supabase, session, dashboard, pollTimer, pendingTab = null;
const TABS = ['home', 'bank', 'market', 'mail', 'commons'];
const MEMBER_TABS = ['bank', 'market', 'mail', 'commons'];
const TAB_LABELS = { bank: 'the Crystal Bank', market: 'the Marketplace', mail: 'Crystal Post', commons: 'the Town Commons' };
const toast = (message) => { const t = $('#toast'); t.textContent = message; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const api = async (path, options = {}) => { if (!session) throw new Error('Please enter the portal first.'); const response = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`, ...(options.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Something went wrong.'); return data; };
const safe = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

// Each feature lives in its own tab. Member tabs stay hidden until a citizen signs in.
function showTab(name, { prompt = true } = {}) {
  if (!TABS.includes(name)) name = 'home';
  if (MEMBER_TABS.includes(name) && !session) { pendingTab = name; if (prompt) { toast(`Sign in to open ${TAB_LABELS[name]}.`); openAuth(); } name = 'home'; }
  TABS.forEach(tab => { const view = $(`#view-${tab}`); if (view) view.hidden = tab !== name; });
  document.querySelectorAll('#tabs [data-tab]').forEach(link => link.classList.toggle('active', link.dataset.tab === name));
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncAccess() {
  const citizen = Boolean(session);
  document.querySelectorAll('[data-member], .door').forEach(el => el.classList.toggle('locked', !citizen));
  document.querySelectorAll('[data-door-state]').forEach(el => el.textContent = citizen ? 'Open →' : 'Citizens only');
  $('#signOutButton').hidden = !citizen;
  $('#heroButton').textContent = citizen ? 'Open your treasury →' : 'Become a citizen →';
  if (!citizen) $('#authButton').textContent = 'Enter portal';
}

function wireCyvapay() {
  const raw = String(window.CRYSTONIA_CYVAPAY_URL || '').trim();
  const url = /^https?:\/\//i.test(raw) ? raw : '';
  document.querySelectorAll('[data-cyvapay]').forEach(el => url ? el.href = url : el.removeAttribute('href'));
  document.querySelectorAll('[data-cyvapay-note]').forEach(el => el.hidden = Boolean(url));
}

function render(data) { dashboard = data; $('#balance').textContent = data.profile.balance; $('#marketGrid').innerHTML = data.listings.map((item, index) => `<article class="item"><div class="product-art art-${index % 4}"><span>${safe(item.icon)}</span><b>${index % 2 ? 'CITIZEN EDITION' : 'OFFICIAL ISSUE'}</b></div><div class="product-copy"><p class="product-kicker">CRYSTONIA MARKET</p><h3>${safe(item.title)}</h3><p>${safe(item.description)}</p><div class="price"><strong>✦ ${item.price} <small>CR</small></strong><button class="buy" data-buy="${item.id}">Add to treasury →</button></div></div></article>`).join(''); $('#inbox').innerHTML = data.mail.length ? data.mail.map(m => `<article class="mail-preview"><span class="mail-gem">◆</span><div><div class="mail-meta"><b>${safe(m.sender?.display_name || 'Crystonian citizen')}</b><time>${new Date(m.created_at).toLocaleDateString([], {month:'short',day:'numeric'})}</time></div><h3>${safe(m.subject)}</h3><p>${safe(m.body)}</p></div></article>`).join('') : '<div class="empty-inbox"><span>✦</span><b>Your inbox is crystal-clear.</b><p>When a citizen writes to you, their message will appear here.</p></div>'; $('#mailCount').textContent = data.mail.length; $('#mailStatus').textContent = data.mail.length ? `${data.mail.length} message${data.mail.length === 1 ? '' : 's'} received` : 'Your recent correspondence'; $('#mailAddress').textContent = `${data.profile.display_name.toLowerCase().replace(/\s+/g, '.')}@crystonia.gov`; $('#chatLog').innerHTML = data.chat.map(m => `<div class="message"><b>${safe(m.profiles?.display_name || 'Citizen')}</b>${safe(m.body)} <time>${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''); $('#authButton').textContent = data.profile.display_name; }
async function refresh() { try { render(await api('/api/dashboard')); } catch (e) { toast(e.message); } }
const startPolling = () => { clearInterval(pollTimer); pollTimer = setInterval(refresh, 10000); };
function openAuth() { authDialog.showModal(); }

async function enterPortal(newSession) {
  session = newSession;
  authDialog.close();
  syncAccess();
  showTab(pendingTab || 'bank');
  pendingTab = null;
  await refresh();
  startPolling();
}

document.addEventListener('click', e => { const el = e.target.closest('[data-tab]'); if (!el) return; e.preventDefault(); showTab(el.dataset.tab); });
document.addEventListener('click', e => { const el = e.target.closest('[data-cyvapay]'); if (el && !el.getAttribute('href')) { e.preventDefault(); toast('The CyvaPay link has not been added yet.'); } });
window.addEventListener('hashchange', () => showTab((location.hash || '#home').slice(1)));
$('#authButton').onclick = () => session ? toast(`Welcome back, ${dashboard?.profile.display_name || 'citizen'}.`) : openAuth();
$('#heroButton').onclick = () => session ? showTab('bank') : openAuth();
$('[data-close]').onclick = () => authDialog.close();
$('#signOutButton').onclick = async () => {
  if (supabase) await supabase.auth.signOut();
  session = null; dashboard = null; clearInterval(pollTimer);
  ['#marketGrid', '#inbox', '#chatLog'].forEach(id => $(id).innerHTML = '');
  $('#balance').textContent = '—'; $('#mailCount').textContent = '0'; $('#mailAddress').textContent = 'sign in to receive mail';
  syncAccess(); showTab('home'); toast('You have left the portal. See you soon.');
};
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active')); b.classList.add('active'); $('#authForm').classList.toggle('signup', b.dataset.mode === 'signup'); });
$('#authForm').onsubmit = async (e) => { e.preventDefault(); const form = new FormData(e.target), signup = $('.tabs .active').dataset.mode === 'signup'; if (!supabase) return toast('Add your Supabase keys to enable citizen access.'); const credentials = { email:form.get('email'), password:form.get('password') }; const result = signup ? await supabase.auth.signUp({ ...credentials, options:{ data:{ display_name:form.get('displayName') } } }) : await supabase.auth.signInWithPassword(credentials); if (result.error) return toast(result.error.message); if (!result.data.session) return toast('Check your email to confirm your citizen account.'); e.target.reset(); toast('Welcome to Crystonia.'); enterPortal(result.data.session); };
$('#transferForm').onsubmit = async e => { e.preventDefault(); try { await api('/api/transfer',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); toast('Crystallines sent.'); refresh(); } catch(x) { toast(x.message); } };
$('#mailForm').onsubmit = async e => { e.preventDefault(); try { await api('/api/mail',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); toast('Crystal mail sent.'); refresh(); } catch(x) { toast(x.message); } };
$('#chatForm').onsubmit = async e => { e.preventDefault(); try { await api('/api/chat',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); refresh(); } catch(x) { toast(x.message); } };
$('#marketGrid').onclick = async e => { const itemId = e.target.dataset.buy; if (!itemId) return; try { await api('/api/purchase',{method:'POST',body:JSON.stringify({itemId})}); toast('A new treasure is yours.'); refresh(); } catch(x) { toast(x.message); } };

async function boot() {
  wireCyvapay();
  const url = window.CRYSTONIA_SUPABASE_URL, key = window.CRYSTONIA_SUPABASE_ANON_KEY;
  if (url && key) { supabase = createClient(url, key); const { data } = await supabase.auth.getSession(); session = data.session; }
  syncAccess();
  showTab((location.hash || '#home').slice(1), { prompt: false });
  if (session) { await refresh(); startPolling(); }
}
boot();
