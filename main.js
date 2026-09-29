// oriapp.eu - the waitlist and the one arrival.
//
// The waitlist writes to the `waitlist` table of Ori's own Supabase project
// (migration 20260929170000_website_waitlist.sql in oriappeu/Ori-app-): the
// public key may add an address and do nothing else. Plain fetch against
// Supabase's REST API - no client library to download for one insert. The key
// below is the project's PUBLIC key (the same one every copy of the app
// carries); what it may do is decided by row-level security, not by hiding it.

const SUPABASE_URL = 'https://sdtxwrooupkrpociynlb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M6IB1lkNmyhZiFri3_kiOA_kBcR6xkP';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The form speaks the page's language: build.mjs writes its messages into the
// page from i18n/<lang>.json.
let T = {};
try { T = JSON.parse(document.getElementById('i18n')?.textContent || '{}'); } catch { T = {}; }

async function join(email) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return 'joined';
  const body = await res.json().catch(() => null);
  // 23505: the address is already on the list - that is a success to the person.
  if (res.status === 409 || body?.code === '23505') return 'already';
  return 'failed';
}

function attach(form) {
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const note = form.nextElementSibling;
  const original = { note: note?.innerHTML ?? '', button: button.textContent };

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
    try { outcome = await join(email); } catch { outcome = 'failed'; }
    if (outcome === 'failed') {
      button.disabled = false;
      button.textContent = original.button;
      note.classList.remove('ok');
      note.textContent = T.failed;
      return;
    }
    input.value = '';
    input.disabled = true;
    button.textContent = outcome === 'already' ? T.btn_already : T.btn_joined;
    note.classList.add('ok');
    note.textContent = outcome === 'already' ? T.note_already : T.note_joined;
  });
}

document.querySelectorAll('form.waitlist').forEach(attach);

// A reload always starts at the top of the page, even when the address still
// carries a section from a menu click (#how). A link shared straight to a
// section (oriapp.eu/#join) still opens there the first time.
const navEntry = performance.getEntriesByType?.('navigation')?.[0];
if (navEntry?.type === 'reload') {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

// ── Motion ──────────────────────────────────────────────────────────────────
// Every effect below has a job (styles.css says which). Reduced motion keeps
// the page still; pointer effects wait for a real mouse.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Headlines: wrap each word so it can rise from behind its own mask. The text
// stays one readable string for assistive tech.
// A word inside a `.gold` phrase keeps its gold.
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

// A grid's cards arrive one after another.
document.querySelectorAll('.grid-2, .grid-3, .grid-4').forEach((grid) => {
  [...grid.children].forEach((child, i) => child.style.setProperty('--i', i));
});

// Arrivals: once each, as they come into view.
const arriving = document.querySelectorAll('.reveal, .split');
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('in');
      seen.unobserve(el);
      // Once it has arrived, a hover must not wait for the stagger delay.
      setTimeout(() => el.style.setProperty('--i', 0), 1200);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
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
  if ('IntersectionObserver' in window) {
    const once = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { play(); once.disconnect(); }
    }, { threshold: 0.5 });
    once.observe(story);
  } else play();
}

// Scroll: the progress bar, the nav's glass, the glows' slow drift.
const bar = document.querySelector('.progress-bar');
const nav = document.querySelector('.nav');
const glows = [...document.querySelectorAll('.aura span')];
const drift = [0.08, -0.05, 0.04];
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    nav?.classList.toggle('scrolled', y > 8);
    if (!reduce) glows.forEach((g, i) => { g.style.transform = `translate3d(0, ${y * drift[i]}px, 0)`; });
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

if (finePointer && !reduce) {
  // Cards: the light follows the pointer. Set on the card itself, never on a
  // parent, so only that card restyles.
  document.querySelectorAll('.card, .principle, .persona, .setup, .founder').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // Buttons lean toward the pointer — a few pixels, no more.
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
  const phone = document.querySelector('.phone');
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
