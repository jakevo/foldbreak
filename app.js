// FoldBreak on the web (port of FoldBreakApp.swift, SetupView.swift and LockScreenView.swift).
//
// Opens to setup. "Start prank" switches to a fake lock screen. Two ways to set off the break:
// - Unfolding a foldable: the page grows to the inner screen and the crease fails.
// - Swiping up on the lock screen (any phone): it "unlocks" into a home screen that breaks.
// Tapping the clock 3 times, or holding the broken screen for 3 s, goes back to setup.
import { prefs, OPTIONS, loadImage, saveImage, imageURL } from './prefs.js';
import { unlockAudio, wakeAudio } from './fx.js';
import { BreakSession, BreakView } from './break.js';
import { buildHome } from './home.js';

const INNER_MIN_SIDE = 560;   // the inner screen's short side is ~669 pt, the cover's ~466
const $ = sel => document.querySelector(sel);
const app = $('#app');

const state = {
  prankActive: false,
  session: null,         // inner screen, after an unfold or unlock
  innerLocked: false,    // prank started while unfolded: show the lock screen first
  isInner: false,
  unfoldCount: 0,
  unlocked: null,        // flat screen, after a swipe-up
};
let view = null;         // current BreakView
if (new URLSearchParams(location.search).has('debug')) window.__fb = state;
let lastShape = null;

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
const isInnerSize = ({ w, h }) => Math.min(w, h) > INNER_MIN_SIDE;

// ---------- screens ----------

function render() {
  if (view) { view.stop(); view = null; }
  app.innerHTML = '';
  document.body.classList.toggle('prank', state.prankActive);
  const vp = viewport();
  const inner = isInnerSize(vp);
  if (!state.prankActive) return renderSetup();
  if (inner && !state.innerLocked) return renderInner(vp);
  if (state.unlocked && !inner) return renderBroken(state.unlocked, vp.w, vp.h, null);
  renderLock();
}

/** Inner screen: always laid out hinge-vertical, turned back if the phone is rotated. */
function renderInner(vp) {
  const cw = Math.max(vp.w, vp.h), ch = Math.min(vp.w, vp.h);
  const turned = vp.h > vp.w;
  const rot = turned ? (screen.orientation && screen.orientation.angle === 90 ? 90 : -90) : 0;
  if (state.session) return renderBroken(state.session, cw, ch, rot);
  const box = stage(cw, ch, rot);
  box.append(buildHome(cw, ch));
}

function stage(w, h, rot) {
  const box = document.createElement('div');
  box.className = 'stage';
  box.style.width = w + 'px'; box.style.height = h + 'px';
  if (rot) box.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
  else box.classList.add('flat');
  app.append(box);
  return box;
}

function renderBroken(session, w, h, rot) {
  const box = stage(w, h, rot);
  const home = buildHome(w, h);
  box.append(home);
  view = new BreakView(box, home, session);
  // Touch: every press adds damage; holding 3 s goes back to setup.
  const hit = document.createElement('div');
  hit.className = 'fill hit';
  box.append(hit);
  let timer = null;
  hit.addEventListener('pointerdown', e => {
    e.preventDefault();
    // Map the touch into the (possibly rotated) stage: undo the rotation around its centre.
    const r = box.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const a = -(rot || 0) * Math.PI / 180;
    const x = dx * Math.cos(a) - dy * Math.sin(a) + w / 2;
    const y = dx * Math.sin(a) + dy * Math.cos(a) + h / 2;
    session.tap(x, y);
    clearTimeout(timer);
    timer = setTimeout(exitPrank, 3000);
  });
  const cancel = () => { clearTimeout(timer); timer = null; };
  hit.addEventListener('pointerup', cancel);
  hit.addEventListener('pointercancel', cancel);
}

// ---------- lock screen ----------

const ICON_FLASH = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M8 2h8v4l-2 4v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10L8 6z"/><circle cx="12" cy="13.5" r="1.2" fill="#555"/></svg>';
const ICON_CAMERA = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.3" fill="#666"/></svg>';

function lockTime() {
  const d = new Date();
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const time = parts.filter(p => p.type !== 'dayPeriod').map(p => p.value).join('').trim();
  return { date, time };
}

function renderLock() {
  const el = document.createElement('div');
  el.className = 'lock fill';
  const photo = prefs.lockWallpaper === 'photo' ? imageURL('lock') : null;
  el.innerHTML = `
    <div class="fill wall ${photo ? '' : 'wp-' + prefs.lockWallpaper}">${photo ? `<img class="fill" src="${photo}" alt=""><div class="fill shade"></div>` : '<i class="glow"></i><i class="dim"></i>'}</div>
    <div class="fill lockui">
      <div class="lockclock"><div class="ldate"></div><div class="ltime clock-${prefs.clockStyle}"></div></div>
      <div class="grow"></div>
      <div class="lockbtns"><span class="cbtn">${ICON_FLASH}</span><span class="cbtn">${ICON_CAMERA}</span></div>
    </div>
    <div class="taparea"></div><div class="swipearea"></div>`;
  app.append(el);
  const ui = el.querySelector('.lockui');
  const tick = () => {
    if (!el.isConnected) return;
    const { date, time } = lockTime();
    el.querySelector('.ldate').textContent = date;
    el.querySelector('.ltime').textContent = time;
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  };
  tick();

  // Back to setup: tap the clock area (top half) 3 times, each within 0.8 s of the last.
  let taps = [], down = null;
  const tap = el.querySelector('.taparea');
  tap.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  tap.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) >= 24) { taps = []; return; }
    const now = Date.now();
    if (taps.length && now - taps[taps.length - 1] > 800) taps = [];
    taps.push(now);
    if (taps.length >= 3) { taps = []; exitPrank(); }
  });

  // Lower half: swipe up to "unlock" into the home screen (which then breaks).
  const sw = el.querySelector('.swipearea');
  let start = null, last = null;
  sw.addEventListener('pointerdown', e => { start = { y: e.clientY, t: performance.now() }; last = start; sw.setPointerCapture(e.pointerId); });
  sw.addEventListener('pointermove', e => {
    if (!start) return;
    const dy = Math.min(0, e.clientY - start.y);
    ui.style.transform = `translateY(${dy * 0.35}px)`;
    ui.style.opacity = String(1 + dy / 600);
    last = { y: e.clientY, t: performance.now() };
  });
  const end = e => {
    if (!start) return;
    const dy = e.clientY - start.y;
    const v = (e.clientY - last.y) / Math.max(1, performance.now() - last.t);   // px/ms
    start = null;
    ui.style.transition = 'transform .3s, opacity .3s';
    ui.style.transform = ''; ui.style.opacity = '';
    setTimeout(() => { ui.style.transition = ''; }, 320);
    if (dy < -80 || (dy < -12 && v < -0.5)) unlock();
  };
  sw.addEventListener('pointerup', end);
  sw.addEventListener('pointercancel', () => { start = null; ui.style.transform = ''; ui.style.opacity = ''; });
}

// ---------- prank flow ----------

function startPrank() {
  unlockAudio();
  state.unfoldCount = 0;
  state.session = null;
  state.unlocked = null;
  state.innerLocked = state.isInner;
  state.prankActive = true;
  render();
}

function exitPrank() {
  state.prankActive = false;
  state.session = null;
  state.unlocked = null;
  state.innerLocked = false;
  render();
}

const isArmed = () => prefs.trigger !== 'secondUnfold' || state.unfoldCount >= 2;

function startSession() {
  const vp = viewport();
  const s = new BreakSession(Math.max(vp.w, vp.h), Math.min(vp.w, vp.h), { armed: isArmed(), hinge: true });
  state.session = s;
  s.begin();
}

function unlock() {
  if (!state.prankActive) return;
  state.unfoldCount += 1;
  const vp = viewport();
  if (isInnerSize(vp)) {
    state.innerLocked = false;
    startSession();
  } else {
    const s = new BreakSession(vp.w, vp.h, { armed: isArmed(), hinge: false });
    state.unlocked = s;
    s.begin();
  }
  render();
}

function onResize() {
  const vp = viewport();
  const inner = isInnerSize(vp);
  const shape = `${inner}:${vp.w > vp.h}`;
  if (shape === lastShape) return;          // ignore small changes (keyboard, toolbars)
  const wasInner = state.isInner;
  lastShape = shape;
  state.isInner = inner;
  if (inner !== wasInner) {
    state.unlocked = null;
    state.innerLocked = false;
    if (inner) {
      if (state.prankActive) { wakeAudio(); state.unfoldCount += 1; startSession(); }
    } else {
      state.session = null;
    }
  } else if (!inner) {
    state.unlocked = null;                  // turning an unlocked flat screen re-locks it
  }
  render();
}

// Locking the phone or leaving resets the prank to its lock screen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.prankActive && !window.__fb) {
    state.unlocked = null;
    if (state.isInner) { state.session = null; state.innerLocked = true; }
    render();
  } else if (document.visibilityState === 'visible') {
    wakeAudio();
  }
});

// ---------- setup ----------

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function select(key, label) {
  const cur = prefs[key];
  return `<label class="cell"><span>${label}</span><select data-key="${key}">${OPTIONS[key].map(([v, l]) =>
    `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function segmented(key) {
  const cur = prefs[key];
  return `<div class="cell"><div class="seg">${OPTIONS[key].map(([v, l]) =>
    `<button data-seg="${key}" data-val="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
}
function photoRow(name, choose) {
  const url = imageURL(name);
  return `<label class="cell photo"><span class="thumb">${url ? `<img src="${url}" alt="">` : '🖼'}</span>
    <span class="link">${url ? choose.replace('Choose', 'Change') : choose}</span>
    <input type="file" accept="image/*" data-photo="${name}" hidden></label>`;
}

const triggerFooter = () => ({
  immediate: 'The screen breaks as soon as it\'s opened.',
  delayed: `Opens looking normal, then breaks after ${prefs.delaySeconds} seconds.`,
  secondUnfold: 'The first opening is fine. It breaks the next time.',
}[prefs.trigger]);

/** How to get the full-screen version: it only exists as a Home Screen icon added from Safari. */
function installCard() {
  // ?ua=... previews another browser (testing only)
  const ua = new URLSearchParams(location.search).get('ua') || navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (!/Android/.test(ua) && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly|Twitter|GSA\/|LinkedInApp|Messenger/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  const link = location.origin + location.pathname;
  if (!iOS) {
    return `<div class="group"><div class="cell card install">
      <b>Open this on your iPhone</b>
      <p>FoldBreak is made for a phone. Open <b>${esc(link)}</b> in Safari on your iPhone, then follow the steps there.</p></div></div>`;
  }
  const notSafari = inApp || otherBrowser;
  return `<div class="group"><div class="cell card install">
    <b>First, add FoldBreak to your Home Screen</b>
    <p class="sub">The prank only works full screen. In a browser, the address bar gives it away.</p>
    ${notSafari ? `<div class="warn"><b>Open this page in Safari first.</b> You're in ${inApp ? 'an app\'s built-in browser' : 'another browser'}.
      Copy the link, open Safari, and paste it in the address bar.
      <button class="copy" id="copylink">Copy link</button></div>` : ''}
    <ol>
      <li>In Safari, tap the <b>Share</b> button <span class="sym">${SHARE_ICON}</span> at the bottom of the screen. If you don't see it, tap <b>•••</b> first.</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Make sure <b>Open as Web App</b> is switched on, then tap <b>Add</b>.</li>
      <li>Close Safari and open <b>FoldBreak</b> from your Home Screen. This message disappears there.</li>
    </ol></div></div>`;
}

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';

function renderSetup() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const el = document.createElement('div');
  el.className = 'setup';
  el.innerHTML = `
    <h1>FoldBreak</h1>
    ${!standalone ? installCard() : ''}
    ${!prefs.seenGuide ? `<div class="group"><div class="cell card guide">
      <b>How it works</b>
      <p>🎚️ Pick how the screen breaks below.</p>
      <p>▶️ Tap Start prank. FoldBreak turns into an ordinary-looking lock screen.</p>
      <p>🤝 Hand the phone over. It breaks when they unfold it, or when they swipe up.</p>
      <p>↩️ To come back here, tap the clock 3 times. On the broken screen, hold your finger down for 3 seconds.</p>
      <button class="link" id="gotit">Got it</button>
    </div></div>` : ''}

    <div class="hdr">Damage</div>
    <div class="group">${OPTIONS.damage.map(([v, l, d]) => `
      <button class="cell choice" data-seg="damage" data-val="${v}"><span><span>${l}</span><small>${d}</small></span>${prefs.damage === v ? '<i class="check">✓</i>' : ''}</button>`).join('')}
    </div>

    <div class="hdr">When it breaks</div>
    <div class="group">${select('trigger', 'Breaks')}${prefs.trigger === 'delayed' ? select('delaySeconds', 'Delay') : ''}</div>
    <div class="ftr">${triggerFooter()}</div>

    <div class="hdr">Sound</div>
    <div class="group">${select('sound', 'Sound')}</div>
    <div class="ftr">Turn the volume up. "Creak + glass" is the real recording from the app.</div>

    <div class="hdr">Home screen that breaks</div>
    <div class="group">${segmented('homeSource')}
      ${prefs.homeSource === 'screenshot' ? photoRow('home', 'Choose screenshot…')
        : `${segmented('homeTheme')}${select('homeWallpaper', 'Wallpaper')}${select('homeLayout', 'Layout')}`}
    </div>
    <div class="ftr">${prefs.homeSource === 'screenshot'
      ? 'Take a screenshot of the real home screen (side button + volume up) on the screen you want to break: unfolded on a foldable, or the normal screen on any other phone. Then pick it here.'
      : 'A built-in home screen. For the most convincing prank, use a screenshot of the real one.'}</div>

    <div class="hdr">Lock screen</div>
    <div class="group">${select('lockWallpaper', 'Wallpaper')}${prefs.lockWallpaper === 'photo' ? photoRow('lock', 'Choose photo…') : ''}${select('clockStyle', 'Clock')}</div>
    <div class="ftr">${prefs.lockWallpaper === 'photo'
      ? 'Pick the phone\'s real wallpaper image (not a screenshot), so the live clock sits on top just like the real lock screen.'
      : 'Match these to the real phone so the lock screen doesn\'t give it away.'}</div>

    <div class="ftr center">Pictures you pick stay on this phone. Nothing is uploaded.</div>
    <div class="spacer"></div>
    <div class="startbar"><button id="start">▶ Start prank</button><small>Tap the clock 3 times to come back here.</small></div>`;
  app.append(el);

  el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
    const k = s.dataset.key;
    prefs[k] = typeof OPTIONS[k][0][0] === 'number' ? Number(s.value) : s.value;
    rerenderSetup();
  }));
  el.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
    prefs[b.dataset.seg] = b.dataset.val;
    rerenderSetup();
  }));
  el.querySelectorAll('[data-photo]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try { await saveImage(inp.dataset.photo, f); } catch { alert('Couldn\'t use that image.'); }
    rerenderSetup();
  }));
  const copy = el.querySelector('#copylink');
  if (copy) copy.addEventListener('click', async () => {
    const link = location.origin + location.pathname;
    try { await navigator.clipboard.writeText(link); copy.textContent = 'Copied ✓'; }
    catch { prompt('Copy this link, then paste it in Safari:', link); }
  });
  const got = el.querySelector('#gotit');
  if (got) got.addEventListener('click', () => { prefs.seenGuide = true; rerenderSetup(); });
  el.querySelector('#start').addEventListener('click', startPrank);
}

function rerenderSetup() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------- start ----------

{
  const vp = viewport();
  state.isInner = isInnerSize(vp);
  lastShape = `${state.isInner}:${vp.w > vp.h}`;
}
const ready = Promise.all([loadImage('home'), loadImage('lock')]).finally(() => {
  window.addEventListener('resize', onResize);
  onResize();
  render();
});
// Keep the page from scrolling or zooming during the prank
document.addEventListener('touchmove', e => { if (state.prankActive) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

// Test hooks for the browser preview: ?start, ?unlock=1.2
const q = new URLSearchParams(location.search);
ready.then(() => {
  if (q.has('damage')) prefs.damage = q.get('damage');
  if (q.has('start') || q.has('unlock')) setTimeout(startPrank, 300);
  if (q.has('unlock')) setTimeout(unlock, 300 + 1000 * Number(q.get('unlock') || 1));
});
