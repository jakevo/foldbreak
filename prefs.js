// Options live in localStorage; picked pictures live in IndexedDB (too big for localStorage).
// Nothing ever leaves the phone.

const DEFAULTS = {
  damage: 'subtle', sound: 'recording', trigger: 'immediate', delaySeconds: 5,
  homeSource: 'builtIn', homeTheme: 'light', homeWallpaper: 'dunes', homeLayout: 'widgets',
  lockWallpaper: 'blue', clockStyle: 'bold', seenGuide: false,
};

function read(key) {
  try {
    const v = localStorage.getItem('fb.' + key);
    return v == null ? DEFAULTS[key] : JSON.parse(v);
  } catch { return DEFAULTS[key]; }
}

export const prefs = new Proxy({}, {
  get: (_, key) => read(key),
  set: (_, key, value) => {
    try { localStorage.setItem('fb.' + key, JSON.stringify(value)); } catch {}
    return true;
  },
});

export const OPTIONS = {
  damage: [
    ['subtle', 'Subtle lines', 'A few thin white lines from the crease. Most convincing.'],
    ['heavy', 'Heavy lines', 'More failed lines and a dead strip along the hinge.'],
    ['shattered', 'Shattered glass', 'Cracked glass radiating from the crease.'],
  ],
  trigger: [['immediate', 'Right away'], ['delayed', 'After a delay'], ['secondUnfold', 'On the 2nd unfold']],
  delaySeconds: [[3, '3 seconds'], [5, '5 seconds'], [10, '10 seconds'], [30, '30 seconds']],
  sound: [['recording', 'Creak + glass'], ['synth', 'Snap'], ['silent', 'Silent']],
  homeSource: [['builtIn', 'Built-in'], ['screenshot', 'My screenshot']],
  homeTheme: [['light', 'Light'], ['dark', 'Dark']],
  homeWallpaper: [['dunes', 'Dunes'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['graphite', 'Graphite']],
  homeLayout: [['widgets', 'Widgets'], ['apps', 'Apps only']],
  lockWallpaper: [['blue', 'Blue'], ['midnight', 'Midnight'], ['purple', 'Purple'], ['forest', 'Forest'], ['photo', 'My photo']],
  clockStyle: [['bold', 'Bold'], ['light', 'Light'], ['rounded', 'Rounded']],
};

// Pictures: 'home' (home-screen screenshot) and 'lock' (lock-screen wallpaper)
let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((ok, fail) => {
      const req = indexedDB.open('foldbreak', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  return dbPromise;
}

const urls = {};

export async function loadImage(name) {
  if (urls[name] !== undefined) return urls[name];
  try {
    const d = await db();
    const blob = await new Promise((ok, fail) => {
      const r = d.transaction('images').objectStore('images').get(name);
      r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
    });
    urls[name] = blob ? URL.createObjectURL(blob) : null;
  } catch { urls[name] = null; }
  return urls[name];
}

export async function saveImage(name, blob) {
  const d = await db();
  await new Promise((ok, fail) => {
    const tx = d.transaction('images', 'readwrite');
    tx.objectStore('images').put(blob, name);
    tx.oncomplete = ok; tx.onerror = () => fail(tx.error);
  });
  if (urls[name]) URL.revokeObjectURL(urls[name]);
  urls[name] = URL.createObjectURL(blob);
  return urls[name];
}

/** Already-loaded picture URL (call loadImage once at startup). */
export const imageURL = name => urls[name] || null;
