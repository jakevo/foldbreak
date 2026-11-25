// The home screen that breaks (port of HomeScreenView.swift): the person's own screenshot,
// or a built-in light/dark home screen drawn with plain HTML.
import { prefs, imageURL } from './prefs.js';

// Simple 24×24 glyphs, drawn here (no Apple artwork).
const G = {
  mail: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3.5 7l8.5 6 8.5-6" fill="none" stroke="currentColor" stroke-width="1.6" style="mix-blend-mode:normal" class="cut"/>',
  note: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5" class="cut"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2" class="cut"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14" class="cut"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 20h8" stroke="currentColor" stroke-width="2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  game: '<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.2a2 2 0 0 1-3.4 1L15 15H9l-2 1.7a2 2 0 0 1-3.4-1L3 12.5A4 4 0 0 1 7 8z"/><path d="M7 11v3M5.5 12.5h3" class="cut"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M5 6l11-3 1 3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 12.5h6" class="cut"/>',
  gear: '<circle cx="12" cy="12" r="6.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="12" r="2.4" class="cutf"/>',
  photos: '<g opacity=".9"><circle cx="12" cy="7.5" r="3.5" fill="#f5a623"/><circle cx="16.5" cy="12" r="3.5" fill="#7ed321"/><circle cx="12" cy="16.5" r="3.5" fill="#4a90e2"/><circle cx="7.5" cy="12" r="3.5" fill="#d0021b"/></g>',
  video: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>',
  phone: '<path d="M6.5 3.5l3 .5 1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 13l4 1.5.5 3c0 1.6-1.4 3-3 3A15.5 15.5 0 0 1 3.5 6.5c0-1.6 1.4-3 3-3z"/>',
  globe: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  music: '<path d="M9 17V6l10-2v11" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="15.5" r="2.5"/>',
  weather: '<circle cx="9" cy="9" r="3.6" fill="#ffd23f"/><path d="M8 19a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 17.5 19z"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4" class="cutf"/>',
  message: '<path d="M12 4c5 0 9 3.2 9 7.3s-4 7.2-9 7.2c-1 0-2-.1-2.9-.4L5 20l1-3.6C4.2 15 3 13.3 3 11.3 3 7.2 7 4 12 4z"/>',
  list: '<circle cx="6" cy="7" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="6" cy="17" r="1.6"/><path d="M10 7h9M10 12h9M10 17h9" stroke="currentColor" stroke-width="1.8"/>',
  book: '<path d="M4 5c3-1 5-1 8 1v14c-3-2-5-2-8-1zM20 5c-3-1-5-1-8 1v14c3-2 5-2 8-1z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calc: '<path d="M6 8h4M8 6v4M14 8h4M6 16h4M14 15h4M14 17.5h4" stroke="currentColor" stroke-width="2"/>',
  chart: '<path d="M3 17l5-5 4 3 8-8" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  house: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
  calendar: '',
};

const APPS = [
  ['Mail', 'mail', ['#4db3ff', '#0a6cff']], ['Notes', 'note', ['#ffffff', '#ececec'], '#f5c400'],
  ['Clock', 'clock', ['#262626', '#000']], ['Maps', 'map', ['#34c759', '#30b0c7']],
  ['TV', 'tv', ['#333', '#000']], ['Store', 'bag', ['#3399ff', '#0a6cff']],
  ['Games', 'game', ['#ff3b30', '#cc1a33']], ['Health', 'heart', ['#fff', '#ededed'], '#ff2d55'],
  ['Wallet', 'wallet', ['#333', '#000']], ['Settings', 'gear', ['#a6a6a6', '#737373']],
  ['Photos', 'photos', ['#fff', '#ededed']], ['Video', 'video', ['#34c759', '#1aa64d']],
  ['Calendar', 'calendar', ['#fff', '#ededed'], '#ff3b30'], ['Weather', 'weather', ['#4d99ff', '#0a6cff']],
  ['Camera', 'camera', ['#999', '#595959']], ['Messages', 'message', ['#34c759', '#1aa64d']],
  ['Reminders', 'list', ['#fff', '#ededed'], '#ff9500'], ['Books', 'book', ['#ff9500', '#f2731a']],
  ['Podcasts', 'mic', ['#af52de', '#8033cc']], ['Files', 'folder', ['#fff', '#ededed'], '#0a84ff'],
  ['Calculator', 'calc', ['#404040', '#000'], '#ff9500'], ['Stocks', 'chart', ['#333', '#000']],
  ['Home', 'house', ['#fff', '#ededed'], '#ff9500'],
];
const DOCK = [['', 'phone', ['#34c759', '#1aa64d']], ['', 'globe', ['#fff', '#ebebeb'], '#0a84ff'],
  ['', 'music', ['#ff5973', '#ff3b30']], ['', 'message', ['#34c759', '#1aa64d']]];

const WALLPAPERS = {
  dunes: [[.93, .93, .94], [.86, .84, .82], [.62, .6, .6], [.76, .72, .68], [.84, .8, .75]],
  ocean: [[.82, .9, .97], [.66, .8, .92], [.35, .55, .78], [.25, .45, .72], [.18, .36, .62]],
  sunset: [[.99, .86, .72], [.98, .7, .62], [.85, .45, .5], [.7, .32, .48], [.5, .22, .42]],
  graphite: [[.88, .88, .9], [.75, .76, .78], [.55, .56, .6], [.45, .46, .5], [.36, .37, .41]],
};

function icon([name, glyph, colors, ink = '#fff'], size) {
  let inner;
  if (glyph === 'calendar') {
    const d = new Date();
    inner = `<div class="cal"><span>${d.toLocaleDateString(undefined, { weekday: 'short' })}</span><b>${d.getDate()}</b></div>`;
  } else {
    inner = `<svg viewBox="0 0 24 24" fill="currentColor">${G[glyph]}</svg>`;
  }
  return `<div class="app" style="--s:${size}px">
    <div class="ic" style="background:linear-gradient(${colors[0]},${colors[1]});color:${ink}">${inner}</div>
    ${name ? `<span>${name}</span>` : ''}</div>`;
}

function wallpaperSVG(w, h, dark) {
  const pal = WALLPAPERS[prefs.homeWallpaper] || WALLPAPERS.dunes;
  const c = ([r, g, b], a = 1) => dark
    ? `rgba(${r * 82 | 0},${g * 82 | 0},${b * 92 | 0},${a})`
    : `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${a})`;
  const dune = (y, amp, col, phase) => {
    const d = `M0 ${h} L0 ${y} C${w * (0.3 + phase)} ${y - amp} ${w * (0.6 - phase)} ${y + amp} ${w} ${y - amp * 0.4} L${w} ${h}Z`;
    const crest = `M0 ${y} C${w * (0.3 + phase)} ${y - amp} ${w * (0.6 - phase)} ${y + amp} ${w} ${y - amp * 0.4}`;
    return `<path d="${d}" fill="${col}"/><path d="${crest}" fill="none" stroke="rgba(255,255,255,${dark ? .06 : .35})" stroke-width="1.2"/>`;
  };
  return `<svg class="fill" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c(pal[0])}"/><stop offset="1" stop-color="${c(pal[1])}"/></linearGradient>
    <radialGradient id="bloom" cx="0.25" cy="0" r="0.6"><stop offset="0" stop-color="rgba(255,255,255,${dark ? .08 : .55})"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#bloom)"/>
    ${dune(h * 0.55, 90, c(pal[2], .55), 0.05)}${dune(h * 0.68, 70, c(pal[3], .85), -0.08)}${dune(h * 0.82, 50, c(pal[4]), 0.1)}
  </svg>`;
}

function weatherWidget() {
  return `<div class="widget weather"><b>Home</b><div class="big light">64°</div><div class="grow"></div>
    <svg viewBox="0 0 24 24" width="20" height="20">${G.weather.replace('<path', '<path fill="#fff"')}</svg>
    <small><b>Partly Cloudy</b></small><small>H:68° L:52°</small></div>`;
}
function dayWidget() {
  const d = new Date();
  return `<div class="widget glass"><div class="red">${d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</div>
    <div class="big">${d.getDate()}</div><div class="grow"></div><small><b>Lunch with Sam</b></small><small class="gray">12:30 – 1:30 PM</small></div>`;
}
function monthWidget() {
  const d = new Date(), day = d.getDate();
  const lead = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead + days; i++) {
    const n = i - lead + 1;
    cells += `<i class="${n === day ? 'today' : ''}">${n > 0 ? n : ''}</i>`;
  }
  return `<div class="widget glass month"><div><div class="big">${day}</div><div class="red">${d.toLocaleDateString(undefined, { weekday: 'long' })}</div>
    <div class="grow"></div><small class="gray">No events today</small></div><div class="grid7">${cells}</div></div>`;
}
function notesWidget() {
  return `<div class="widget glass notes"><div class="nh">Notes</div><div class="nb"><small><b>Groceries</b></small>
    <small class="gray">oat milk, eggs, coffee</small><small class="gray">Pick up phone case</small></div></div>`;
}
function remindersWidget() {
  return `<div class="widget glass"><div class="row"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="#0a84ff"/><path d="M8 8h8M8 12h8M8 16h8" stroke="#fff" stroke-width="1.8"/></svg><b class="num">3</b></div>
    <small><b>Reminders</b></small><small class="todo">Call mom</small><small class="todo">Gym 6pm</small></div>`;
}
function searchWidget() {
  return `<div class="widget glass"><div class="grow"></div><div class="row start"><span class="chip round">⌕</span><span class="chip pill"></span></div></div>`;
}

/** Builds the home screen for a w×h screen and returns the element. */
export function buildHome(w, h) {
  const el = document.createElement('div');
  el.className = 'home fill';
  el.style.width = w + 'px'; el.style.height = h + 'px';
  const shot = prefs.homeSource === 'screenshot' ? imageURL('home') : null;
  if (shot) {
    // A screenshot only fits the screen shape it was taken on; otherwise use the built-in one.
    el.innerHTML = `<img class="fill shot" src="${shot}" alt="">`;
    const img = el.firstChild;
    const check = () => { if ((img.naturalWidth > img.naturalHeight) !== (w > h)) builtIn(el, w, h); };
    if (img.complete) check(); else img.onload = check;
    return el;
  }
  builtIn(el, w, h);
  return el;
}

function builtIn(el, w, h) {
  const dark = prefs.homeTheme === 'dark';
  el.classList.toggle('dark', dark);
  if (h > w) {
    const count = h > 760 ? 16 : 12;
    el.innerHTML = `${wallpaperSVG(w, h, dark)}<div class="portrait">
      <div class="row gap16">${weatherWidget()}${dayWidget()}</div>
      <div class="icons4">${APPS.slice(0, count).map(a => icon(a, 60)).join('')}</div>
      <div class="grow"></div>
      <div class="dock glass">${DOCK.map(a => icon(a, 58)).join('')}</div></div>`;
  } else {
    const left = prefs.homeLayout === 'widgets'
      ? `<div class="page"><div style="height:160px">${monthWidget()}</div><div class="row gap18"><div class="sq">${notesWidget()}</div><div class="sq">${remindersWidget()}</div></div><div class="sq wide">${searchWidget()}</div></div>`
      : `<div class="page"><div class="icons4 tight">${APPS.slice(12).concat(APPS.slice(0, 4)).map(a => icon(a, 56)).join('')}</div></div>`;
    el.innerHTML = `${wallpaperSVG(w, h, dark)}
      <div class="lpage" style="left:${(w / 2 - 300) / 2}px">${left}</div>
      <div class="rpage" style="left:${w / 2 + 34}px"><div class="row gap18"><div class="sq">${weatherWidget()}</div><div class="sq">${dayWidget()}</div></div>
        <div class="icons4 tight">${APPS.slice(0, 12).map(a => icon(a, 56)).join('')}</div></div>
      <div class="sidedock glass" style="left:${w - 40}px;top:${h * 0.62}px">${DOCK.slice(0, 3).map(a => icon(a, 48)).join('')}</div>`;
  }
}
