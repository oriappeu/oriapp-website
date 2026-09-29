// oriapp.eu — the waitlist and the one arrival.
//
// The waitlist writes to the same `waitlist` table in the same Supabase project
// the previous site used, so no signup is lost in the move. Plain fetch against
// Supabase's REST API — no client library to download for one insert. The key
// below is the project's PUBLIC anon key (it was on the old site too); what it
// may do is decided by the table's row-level security, not by hiding it.

const SUPABASE_URL = 'https://rqluecojhplvfiytybty.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbHVlY29qaHBsdmZpeXR5YnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjM5ODksImV4cCI6MjA5NDQzOTk4OX0.qmZxISA7qnGnnLT7mCyJc7yOCJVsDywzzk21lt9jIPY';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  // 23505: the address is already on the list — that is a success to the person.
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
      note.textContent = 'That doesn’t look like an email address.';
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Joining…';
    let outcome = 'failed';
    try { outcome = await join(email); } catch { outcome = 'failed'; }
    if (outcome === 'failed') {
      button.disabled = false;
      button.textContent = original.button;
      note.classList.remove('ok');
      note.textContent = 'Something went wrong. Check your connection and try again.';
      return;
    }
    input.value = '';
    input.disabled = true;
    button.textContent = outcome === 'already' ? 'Already on the list' : 'You’re on the list';
    note.classList.add('ok');
    note.textContent = outcome === 'already'
      ? 'You’re already on the waitlist — we’ll be in touch.'
      : 'Thank you. We’ll email you once when your spot is ready.';
  });
}

document.querySelectorAll('form.waitlist').forEach(attach);

// The one arrival (style lock, rule 13): each section settles in once, as it
// first comes into view. Nothing replays.
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); seen.unobserve(entry.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => seen.observe(el));
} else {
  items.forEach((el) => el.classList.add('in'));
}
