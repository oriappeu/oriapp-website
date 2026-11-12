// oriapp.eu - the sign-up form, the unsubscribe page and the page's motion.
//
// The waitlist form posts to Ori's backend, POST /api/waitlist/join (backend/lib/waitlistJoin.js in
// oriappeu/Ori-app-, security B3): { email, lang, turnstileToken }. The backend checks the Cloudflare
// Turnstile token and its limits, adds the address, and a new address starts the thank-you email there.
// The site no longer writes to Supabase itself: migration 20261104120100_waitlist_backend_only took that
// away from the public key. A new and a known address get the same answer (200), so the page cannot tell
// them apart and says the same thank-you to both.

const BACKEND_URL = 'https://ori-backend-yu2e.onrender.com';

// Cloudflare Turnstile, the check that a person and not a script sent the form. The founder pastes the
// PUBLIC site key from the Cloudflare dashboard here (Turnstile → the oriapp.eu widget → Site Key; task
// T-20 step 6). It is public by design: every visitor's browser gets it. The secret key lives only on the
// backend (TURNSTILE_SECRET_KEY on Render). Until the key is pasted the check is not loaded, so the form
// can only answer with its failure message.
const TURNSTILE_SITE_KEY = '0x4AAAAAAF-wgIBcUGbkDQbA';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LANG = ['cs', 'sk', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'cs';

// The form speaks the page's language: build.mjs writes its messages into the
// page from i18n/<lang>.json.
let T = {};
try { T = JSON.parse(document.getElementById('i18n')?.textContent || '{}'); } catch { T = {}; }

// 'joined' (200, a new or a known address alike), 'invalid' (400: the backend refused the address) or
// 'failed' (403 a bad or spent token, 429 too many tries, 503 the list or Cloudflare is down, no network).
async function join(email, turnstileToken) {
  const res = await fetch(`${BACKEND_URL}/api/waitlist/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The page's language decides the thank-you email's (cs, sk or en).
    body: JSON.stringify({ email, lang: LANG, turnstileToken }),
  });
  if (res.ok) return 'joined';
  if (res.status === 400) return 'invalid';
  return 'failed';
}

// ── Turnstile ───────────────────────────────────────────────────────────────
// One widget per waitlist form, run as soon as the page loads, so a token is usually ready before the
// address is typed. Managed mode, and shown only when Cloudflare wants the visitor to tick it
// (interaction-only); otherwise it stays out of sight. A token is good for one try and five minutes:
// the widget renews an expired one by itself, and every try that sent a token resets it for a fresh one.
// When Cloudflare does show the box, `interactive` is true until it is ticked: a try made then says so
// (T.captcha) and waits for the tick, then sends by itself, instead of failing after 20 seconds.
const captchas = []; // { slot, id, token, waiting, interactive, onAsk }
const ASK_WAIT_MS = 3 * 60 * 1000; // how long a try waits for the box to be ticked
let captchaDown = false;
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=oriTurnstileReady';

function settle(c, token) {
  c.token = token;
  c.waiting.splice(0).forEach((done) => done(token));
}
function captchaFailed() {
  captchaDown = true;
  captchas.forEach((c) => settle(c, ''));
}
// The widget's token right now, or ''.
function tokenNow(c) {
  if (!c) return '';
  try {
    if (c.id != null && window.turnstile) {
      if (window.turnstile.isExpired?.(c.id)) return '';
      return window.turnstile.getResponse(c.id) || c.token || '';
    }
  } catch { /* the callback's token below */ }
  return c.token || '';
}
// The token for a try: the current one, or the next one the widget gives, or '' when the check cannot
// run here. It waits 20 seconds for an invisible check; while the box asks to be ticked, up to
// ASK_WAIT_MS, so the person has time to tick it.
function tokenFor(c) {
  const now = tokenNow(c);
  if (now || !c || captchaDown) return Promise.resolve(now);
  return new Promise((resolve) => {
    c.waiting.push(resolve);
    const started = Date.now();
    const check = () => {
      if (!c.waiting.includes(resolve)) return; // settled
      const limit = c.interactive ? ASK_WAIT_MS : 20000;
      if (Date.now() - started >= limit) {
        c.waiting.splice(c.waiting.indexOf(resolve), 1);
        resolve('');
      } else setTimeout(check, 1000);
    };
    setTimeout(check, 1000);
  });
}
// A try spends its token (the backend redeems it with Cloudflare): ask the widget for a new one.
function spend(c) {
  if (!c) return;
  c.token = '';
  try { if (c.id != null) window.turnstile?.reset(c.id); } catch { /* the next try waits for a fresh token */ }
}
function renderCaptcha(c) {
  try {
    c.id = window.turnstile.render(c.slot, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: 'interaction-only',
      theme: 'dark',
      language: LANG,
      callback: (token) => settle(c, token),
      'expired-callback': () => { c.token = ''; },
      // Cloudflare shows the box: a try already waiting tells the person to tick it.
      'before-interactive-callback': () => { c.interactive = true; c.onAsk?.(); },
      'after-interactive-callback': () => { c.interactive = false; },
      // A failed check: a waiting try gives up now (the widget retries by itself for the next one).
      'error-callback': () => settle(c, ''),
    });
  } catch { settle(c, ''); }
}
function startCaptchas() {
  if (!captchas.length) return;
  if (TURNSTILE_SITE_KEY === 'REPLACE_WITH_SITE_KEY') {
    console.warn('oriapp.eu: no Turnstile site key yet (TURNSTILE_SITE_KEY in main.js), so the waitlist form cannot send.');
    captchaFailed();
    return;
  }
  window.oriTurnstileReady = () => captchas.forEach(renderCaptcha);
  const script = document.createElement('script');
  script.src = TURNSTILE_SRC;
  script.async = true;
  // Blocked or offline: a try fails at once with the form's failure message instead of waiting.
  script.addEventListener('error', captchaFailed);
  document.head.append(script);
}

function attach(form) {
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const note = form.nextElementSibling;
  const original = { button: button.textContent };
  // The widget's place: under the form's note, so the form and its note keep their layout.
  const captcha = { slot: document.createElement('div'), id: null, token: '', waiting: [], interactive: false, onAsk: null };
  captcha.slot.className = 'captcha';
  note.after(captcha.slot);
  captchas.push(captcha);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // A bot fills every field; a person never sees this one.
    if (form.querySelector('input[name="company"]')?.value) return;
    const email = input.value.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      note.classList.remove('ok');
      note.textContent = T.invalid;
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = T.joining;
    let outcome = 'failed';
    let sent = false;
    // The box is (or comes) up and not ticked yet: say so, and send as soon as it is ticked.
    const ask = () => { note.classList.remove('ok'); note.textContent = T.captcha; };
    captcha.onAsk = ask;
    if (!tokenNow(captcha) && captcha.interactive) ask();
    try {
      const token = await tokenFor(captcha);
      if (token) { sent = true; outcome = await join(email, token); }
      else if (captcha.interactive) outcome = 'unticked';
    } catch { outcome = 'failed'; }
    captcha.onAsk = null;
    // Only a token the backend has redeemed is spent; an unticked box stays up as it is.
    if (sent) spend(captcha);
    if (outcome !== 'joined') {
      button.disabled = false;
      button.textContent = original.button;
      note.classList.remove('ok');
      note.textContent = outcome === 'invalid' ? T.invalid : outcome === 'unticked' ? T.captcha : T.failed;
      if (outcome === 'invalid') input.focus();
      return;
    }
    input.value = '';
    input.disabled = true;
    button.textContent = T.btn_joined;
    note.classList.add('ok');
    note.textContent = T.note_joined;
    // Counted in Umami as an event - which form and which language, never the address.
    try {
      window.umami?.track('waitlist-joined', { form: form.id, lang: document.documentElement.lang });
    } catch { /* counting must never break the form */ }
    // On to the setup page (download the Android app, add the iPhone one), carrying the address for its
    // download button. A moment first, so the thank-you above is seen and the count above is sent.
    try { sessionStorage.setItem(SETUP_EMAIL, email); sessionStorage.setItem(SETUP_JOINED, '1'); } catch { /* the page asks again */ }
    setTimeout(() => { location.href = SETUP_URL; }, 900);
  });
}

// The setup page, in the page's language. The address travels in sessionStorage (this tab only, gone when it
// closes), never in the URL, so it cannot end up in a log, a history entry or an analytics referrer.
const SETUP_URL = `${{ cs: '/', sk: '/sk/', en: '/en/' }[LANG]}setup`;
const SETUP_EMAIL = 'ori_setup_email';
const SETUP_JOINED = 'ori_setup_joined';

document.querySelectorAll('form.waitlist:not(.apk-form)').forEach(attach);
// Only pages with a waitlist form load Turnstile (the setup page's download form does not use it).
startCaptchas();

// ── The setup page (src/setup.html) ─────────────────────────────────────────────────────────────────────
// Pick a phone (the one this browser runs on is picked for you), then follow its steps. Android's button asks
// the backend for a ten-minute link to the APK (POST /api/apk/link, backend/lib/apkLink.js in
// oriappeu/Ori-app-): the address goes on the waitlist if it is not there yet, and the file is never at a
// public address. Without script both phones' steps simply show, one under the other.
const pick = document.querySelector('.os-pick');
if (pick) {
  const ua = navigator.userAgent;
  const detected = /android/i.test(ua) ? 'android'
    : (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? 'iphone' : null;
  const show = (os) => {
    document.querySelectorAll('.os-panel').forEach((p) => { p.hidden = p.id !== os; });
    pick.querySelectorAll('.os-btn').forEach((b) => b.setAttribute('aria-current', String(b.dataset.os === os)));
  };
  pick.querySelectorAll('.os-btn').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    show(b.dataset.os);
    try { window.umami?.track('setup-os', { os: b.dataset.os, lang: LANG }); } catch { /* never block */ }
  }));
  show(detected || 'android');
  if (!detected) document.querySelector('.os-desktop').hidden = false;
  try {
    if (sessionStorage.getItem(SETUP_JOINED)) document.querySelector('.setup-joined').hidden = false;
    sessionStorage.removeItem(SETUP_JOINED);
  } catch { /* no storage: no banner */ }

  const form = document.querySelector('form.apk-form');
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const note = form.nextElementSibling;
  const print = document.querySelector('.fingerprint');
  try { input.value = sessionStorage.getItem(SETUP_EMAIL) || ''; } catch { /* typed by hand */ }
  const say = (text, ok) => { note.textContent = text; note.classList.toggle('ok', !!ok); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!EMAIL.test(email)) { say(T.invalid); input.focus(); return; }
    const label = button.textContent;
    button.disabled = true;
    say(T.apk_preparing, true);
    let res = null, body = null;
    try {
      res = await fetch(`${BACKEND_URL}/api/apk/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: LANG }),
      });
      body = await res.json().catch(() => null);
    } catch { res = null; }
    button.disabled = false;
    if (res?.ok && body?.url) {
      try { sessionStorage.setItem(SETUP_EMAIL, email); } catch { /* fine */ }
      say(T.apk_started, true);
      button.textContent = T.apk_again;
      if (body.sha256) { print.querySelector('code').textContent = body.sha256; print.hidden = false; }
      try { window.umami?.track('apk-download', { lang: LANG, version: body.version || '' }); } catch { /* never block */ }
      location.href = body.url;
      return;
    }
    button.textContent = label;
    say(res?.status === 429 ? T.apk_busy
      : body?.code === 'bad_email' ? T.invalid
      : body?.code === 'apk_no_build' ? T.apk_not_ready
      : T.failed);
  });
}

// ── The unsubscribe page (src/unsubscribe.html) ─────────────────────────────────────────────────────────
// The thank-you email links https://oriapp.eu/unsubscribe?t=<token> (backend/lib/waitlistWelcome.js in
// oriappeu/Ori-app-). One tap posts the token to POST /api/waitlist/unsubscribe (lib/waitlistUnsubscribe.js),
// which deletes that row; it answers 200 whether or not the token was on the list. The token goes nowhere
// else: the page loads no analytics and sends no referrer, and no event carries it.
const unsubButton = document.querySelector('.unsub-btn');
if (unsubButton) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const token = (new URLSearchParams(location.search).get('t') || '').trim();
  const valid = UUID.test(token);
  const note = document.querySelector('.unsub-note');
  // The language switcher keeps the token, and a pick tells the Czech page not to send this tab on to the
  // browser's language (the script in the page's head).
  document.querySelectorAll('.lang a').forEach((a) => {
    if (valid) a.href = `${a.getAttribute('href')}?t=${encodeURIComponent(token)}`;
    a.addEventListener('click', () => { try { sessionStorage.setItem('ori_lang_picked', '1'); } catch { /* the browser's language decides */ } });
  });
  if (!valid) {
    // No token, or one cut short (a mail app that broke the link): say so; the button stays off.
    document.querySelector('.unsub-hint').hidden = false;
  } else {
    unsubButton.disabled = false;
    unsubButton.addEventListener('click', async () => {
      unsubButton.disabled = true;
      let res = null;
      try {
        res = await fetch(`${BACKEND_URL}/api/waitlist/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t: token }),
        });
      } catch { res = null; }
      if (res?.ok) {
        unsubButton.hidden = true;
        note.classList.add('ok');
        note.textContent = unsubButton.dataset.done;
        return;
      }
      unsubButton.disabled = false;
      note.classList.remove('ok');
      note.textContent = T.failed;
    });
  }
}

// WebMCP (https://webmachinelearning.github.io/webmcp/): a browser AI agent acting for a person can
// read what Ori is and put that person on the waitlist without driving the form. The same join() and
// thank-you email as the form; the page's language picks the email's. Registered only on pages with
// the form, and only where the browser offers the API (older Chrome builds put it on navigator).
const modelContext = document.modelContext ?? navigator.modelContext;
const reply = (text) => ({ content: [{ type: 'text', text }] });
if (document.querySelector('form.waitlist:not(.apk-form)') && typeof modelContext?.registerTool === 'function') {
  const register = (tool) => {
    try { Promise.resolve(modelContext.registerTool(tool)).catch(() => {}); } catch { /* the page works without it */ }
  };
  register({
    name: 'get_ori_overview',
    description: 'Key facts about Ori (oriapp.eu), the AI goal coach app: what it does, status, platforms, data, team, contact. Plain text, English.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const res = await fetch('/llms.txt');
      return reply(res.ok ? await res.text() : 'Could not load https://oriapp.eu/llms.txt');
    },
  });
  register({
    name: 'join_ori_waitlist',
    description: 'Put an email address on the waitlist for Ori, the AI goal coach app, and send it the thank-you email. Use only with the address of the person you are acting for and at their explicit request. The address is stored only for the waitlist: https://oriapp.eu/en/privacy',
    inputSchema: {
      type: 'object',
      properties: { email: { type: 'string', format: 'email', description: "The person's own email address" } },
      required: ['email'],
    },
    async execute({ email } = {}) {
      email = String(email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) return reply('That is not a valid email address.');
      // The same anti-bot check as the form: the token one of the page's Turnstile widgets holds right now.
      const captcha = captchas.find((c) => tokenNow(c));
      if (!captcha) {
        return reply('The page has no anti-bot token yet (Cloudflare Turnstile has not finished, or was blocked), so it cannot join now. Wait a few seconds and try again; if it keeps failing, ask the person to use the form at https://oriapp.eu/en/#zapis');
      }
      let outcome = 'failed';
      try { outcome = await join(email, tokenNow(captcha)); } catch { outcome = 'failed'; }
      spend(captcha);
      if (outcome === 'invalid') return reply('That is not a valid email address.');
      if (outcome === 'failed') return reply('Joining failed. Try again later, or use the form at https://oriapp.eu/en/#zapis');
      try { window.umami?.track('waitlist-joined', { form: 'webmcp', lang: LANG }); } catch { /* never block */ }
      // The backend answers a known address like a new one, so this cannot say which it was.
      return reply(`${email} is on the Ori waitlist. If it was new to the list, a thank-you email is on its way; access opens gradually.`);
    },
  });
}

// A reload always starts at the top of the page, even when the address still
// carries a section from a menu click (#jak). A link shared straight to a
// section (oriapp.eu/#zapis) still opens there the first time.
const navEntry = performance.getEntriesByType?.('navigation')?.[0];
if (navEntry?.type === 'reload') {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

// ── In-page links ───────────────────────────────────────────────────────────
// A link to a section of THIS page (the menu, "Join the waitlist") scrolls there
// without putting "#zapis" in the address bar, and a link to the page itself (the
// logo) scrolls to the top instead of reloading. Without script every link still
// works as a plain anchor. A modified click (new tab, new window) is left alone.
const samePage = (p) => p.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
function sectionFor(link) {
  let u;
  try { u = new URL(link.getAttribute('href'), location.href); } catch { return null; }
  if (u.origin !== location.origin || samePage(u.pathname) !== samePage(location.pathname)) return null;
  return u.hash ? document.getElementById(decodeURIComponent(u.hash.slice(1))) : document.body;
}
document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[href]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (link.target && link.target !== '_self') return;
  const target = sectionFor(link);
  if (!target) return;
  e.preventDefault();
  if (target === document.body) window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  else {
    target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    // Keyboard and screen-reader focus follow the scroll.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});
function reduceMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
// Arriving from another page ("/#zapis" from the FAQ menu): the browser jumps to the
// section by itself, then the section name is dropped from the address.
if (location.hash) {
  window.addEventListener('load', () => setTimeout(() => history.replaceState(null, '', location.pathname + location.search), 80), { once: true });
}

// ── Motion ──────────────────────────────────────────────────────────────────
// Every effect below has a job (styles.css says which). Reduced motion keeps
// the page still; pointer effects wait for a real mouse.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasIO = 'IntersectionObserver' in window;

// Headlines: wrap each word so it can rise from behind its own mask. The text
// stays one readable string for assistive tech. A word inside a `.gold` phrase
// keeps its gold.
document.querySelectorAll('.split').forEach((el) => {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const words = [];
  el.childNodes.forEach((node) => {
    const gold = node.nodeType === 1 && node.classList.contains('gold');
    for (const word of node.textContent.split(/\s+/)) if (word) words.push({ word, gold });
  });
  el.setAttribute('aria-label', text);
  el.innerHTML = words.map(({ word, gold }, i) =>
    `<span class="w" aria-hidden="true"><span${gold ? ' class="gold"' : ''} style="--w:${i}">${word}</span></span>`).join(' ');
});

// Arrivals: once each, as they come into view.
const arriving = document.querySelectorAll('.reveal, .split');
if (hasIO) {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      seen.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  arriving.forEach((el) => seen.observe(el));
} else {
  arriving.forEach((el) => el.classList.add('in'));
}

// The hero's story: a day re-routing itself, in four beats, once.
const story = document.querySelector('.story');
if (story) {
  const beats = ['s1', 's2', 's3', 's4'];
  const play = () => {
    if (reduce) { story.classList.add(...beats); return; }
    beats.forEach((beat, i) => setTimeout(() => story.classList.add(beat), 350 + i * 520));
  };
  if (hasIO) {
    const once = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { play(); once.disconnect(); }
    }, { threshold: 0.5 });
    once.observe(story);
  } else play();
}

// The week where the plan breaks. On a wide screen it plays once, a day after
// another, when it comes into view; on a phone, where the days stack, each day
// arrives as it is scrolled to.
const week = document.getElementById('week');
if (week) {
  const days = [...week.querySelectorAll('.day')];
  if (reduce || !hasIO) {
    days.forEach((d) => d.classList.add('in'));
  } else if (matchMedia('(max-width: 720px)').matches) {
    const each = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('in'); each.unobserve(entry.target); }
    }, { threshold: 0.6 });
    days.forEach((d) => each.observe(d));
  } else {
    const whole = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      whole.disconnect();
      days.forEach((d, i) => setTimeout(() => d.classList.add('in'), 200 + i * 430));
    }, { threshold: 0.4 });
    whole.observe(week);
  }
}

// Scroll: the progress bar, the top bar's glass, the glows' slow drift, and the
// route down the first-week timeline (a gold line that follows the reader).
const bar = document.querySelector('.progress-bar');
const nav = document.querySelector('.nav');
const glows = [...document.querySelectorAll('.aura span')];
const drift = [0.08, -0.05, 0.04];
const route = document.getElementById('route');
const stops = route ? [...route.querySelectorAll('.tl-row')] : [];
let ticking = false;
function updateRoute() {
  if (!route) return;
  const r = route.getBoundingClientRect();
  const line = window.innerHeight * 0.62;
  route.style.setProperty('--p', Math.max(0, Math.min(1, (line - r.top) / r.height)).toFixed(4));
  stops.forEach((row) => row.classList.toggle('reached', row.getBoundingClientRect().top + 18 < line));
}
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    nav?.classList.toggle('scrolled', y > 8);
    if (!reduce) glows.forEach((g, i) => { g.style.transform = `translate3d(0, ${y * drift[i]}px, 0)`; });
    updateRoute();
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
window.addEventListener('load', onScroll);
onScroll();

if (finePointer && !reduce) {
  // Buttons lean toward the pointer: a few pixels, no more.
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      btn.style.setProperty('--tx', `${(x * 6).toFixed(1)}px`);
      btn.style.setProperty('--ty', `${(y * 4).toFixed(1)}px`);
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.setProperty('--tx', '0px');
      btn.style.setProperty('--ty', '0px');
    });
  });

  // The phone tilts toward the pointer while it is over the hero.
  const hero = document.querySelector('.hero');
  const phone = document.querySelector('.hero .phone');
  if (hero && phone) {
    hero.addEventListener('pointermove', (e) => {
      const r = phone.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      phone.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      phone.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      phone.style.setProperty('--ry', '0deg');
      phone.style.setProperty('--rx', '0deg');
    });
  }
}

// ── Questions ───────────────────────────────────────────────────────────────
// A <details> opens and closes at once; here it slides. Opening: set `open` so
// the answer exists, read its layout once (so the browser has the collapsed
// row as a starting point), then add .is-open and the row grows from 0 in the
// same frame. Closing: drop .is-open, and only take `open` away once the row
// has shrunk. A tap mid-way simply reverses (styles.css uses transitions).
document.querySelectorAll('.faq-item').forEach((item) => {
  const summary = item.querySelector('summary');
  const body = item.querySelector('.faq-body');
  if (!summary || !body) return;
  item.classList.add('faq-anim');
  if (item.open) item.classList.add('is-open');
  let closing = 0;
  summary.addEventListener('click', (e) => {
    e.preventDefault();
    clearTimeout(closing);
    if (item.classList.contains('is-open')) {
      item.classList.remove('is-open');
      if (reduce) { item.open = false; return; }
      const finish = () => { if (!item.classList.contains('is-open')) item.open = false; };
      body.addEventListener('transitionend', function done(ev) {
        if (ev.target !== body) return;
        body.removeEventListener('transitionend', done);
        finish();
      });
      closing = setTimeout(finish, 450); // in case transitionend never comes
    } else {
      item.open = true;
      void body.offsetHeight; // commit the collapsed state before growing
      item.classList.add('is-open');
    }
  });
});

// ── Try it ──────────────────────────────────────────────────────────────────
// A small working model of the app. One state object, one render; CSS draws
// every state from the attributes set here. Step 1: low energy re-plans the
// day. Step 2: ticking the smaller step fills the milestone. Step 3: the
// roadmap shows the goal still on track.
const demo = document.querySelector('.demo');
if (demo) {
  const section = document.getElementById('jak');
  const steps = [...document.querySelectorAll('.try-steps li')];
  const quickSlot = demo.querySelector('.d-quick-slot');
  const fresh = () => ({ energy: 'mid', ticked: false, tab: 'today', sawRoad: false });
  let state = fresh();

  const render = () => {
    const step = state.energy !== 'low' ? 1 : !state.ticked ? 2 : !state.sawRoad ? 3 : 4;
    demo.dataset.energy = state.energy;
    demo.dataset.tab = state.tab;
    demo.dataset.step = String(step);
    demo.classList.toggle('ticked', state.ticked);
    section.classList.toggle('finished', step === 4);
    steps.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('done', n < step);
      li.classList.toggle('current', n === step);
    });
    demo.querySelectorAll('[data-set-energy]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setEnergy === state.energy)));
    demo.querySelectorAll('[data-set-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.setTab === state.tab)));
    demo.querySelector('.demo-check').setAttribute('aria-checked', String(state.ticked));
    // What is hidden cannot be reached with the keyboard either.
    demo.querySelectorAll('[data-screen]').forEach((s) => { s.inert = s.dataset.screen !== state.tab; });
    quickSlot.inert = state.energy !== 'low';
  };

  demo.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.setEnergy) {
      state.energy = button.dataset.setEnergy;
      // Back to a normal day: the original plan returns, the small step with it.
      if (state.energy !== 'low') state.ticked = false;
    } else if (button.classList.contains('demo-check')) {
      state.ticked = !state.ticked;
    } else if (button.dataset.setTab) {
      state.tab = button.dataset.setTab;
      if (state.tab === 'road' && state.ticked) state.sawRoad = true;
    }
    render();
  });
  section.querySelector('.try-reset')?.addEventListener('click', () => { state = fresh(); render(); });
  render();
}
