export const mobileShell = `<div class="mobile-status" role="status"><span data-network>Internetkapcsolat ellenőrzése…</span><span data-ready>Offline előkészítés folyamatban…</span></div><div data-update class="update-notice hidden"><span>Új alkalmazásverzió érhető el.</span><button data-refresh>Mentés és frissítés</button></div><p data-error role="alert" class="hidden"></p><details class="install-help"><summary>Telepítés telefonra · Android és iPhone</summary><div class="install-columns"><div><h3>Android</h3><p>Chrome-ban válaszd a menüben a „Telepítés” vagy a „Hozzáadás a kezdőképernyőhöz” lehetőséget.</p><button class="primary hidden" data-install>Alkalmazás telepítése</button></div><div><h3>iPhone</h3><p>Nyisd meg Safariban, majd Megosztás → Főképernyőhöz adás → Hozzáadás.</p></div></div><p class="muted">Az első megnyitáshoz internet szükséges. Várd meg az „Offline használatra kész” jelzést. A felvételek ezen a készüléken maradnak; nincs automatikus szinkron.</p></details>`;
export function mountMobile(root, production = true) {
  const $ = s => root.querySelector(s);
  const abort = new AbortController();
  let disposed = false, registration, waiting, installPrompt;
  const timers = new Set();
  const listen = (node, name, fn) => node.addEventListener(name, fn, { signal: abort.signal });
  const showError = text => { $('[data-error]').textContent = text; $('[data-error]').classList.remove('hidden'); };
  function connection() {
    $('[data-network]').textContent = navigator.onLine ? '● Internetkapcsolat elérhető' : '● Nincs internetkapcsolat';
    $('[data-network]').className = navigator.onLine ? 'network-online' : 'network-offline';
    if (navigator.onLine) registration?.update().catch(() => {});
  }
  function installed() { $('.install-help').classList.add('hidden'); }
  function verify() {
    if (!registration?.active) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { if (!disposed) $('[data-ready]').textContent = 'Az offline előkészítés nem sikerült. Internet mellett nyisd meg újra az appot.'; channel.port1.close(); }, 10000);
    timers.add(timeout);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); timers.delete(timeout); channel.port1.close();
      if (!disposed) $('[data-ready]').textContent = event.data?.ready ? 'Offline használatra kész' : 'Az offline előkészítés nem sikerült.';
    };
    registration.active.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
  }
  function watch() {
    const worker = registration.installing;
    if (!worker) return;
    listen(worker, 'statechange', () => {
      if (worker.state === 'installed' && registration.waiting && navigator.serviceWorker.controller) {
        waiting = registration.waiting; $('[data-update]').classList.remove('hidden');
      }
      if (worker.state === 'activated') verify();
      if (worker.state === 'redundant' && !registration.active) $('[data-ready]').textContent = 'Az offline előkészítés nem sikerült.';
    });
  }
  connection();
  listen(window, 'online', connection); listen(window, 'offline', connection);
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) installed();
  listen(window, 'appinstalled', installed);
  listen(window, 'beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('[data-install]').classList.remove('hidden'); });
  listen($('[data-install]'), 'click', async () => {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; } catch { showError('A telepítést a böngésző menüjéből is elindíthatod.'); }
    installPrompt = null; $('[data-install]').classList.add('hidden');
  });
  listen($('[data-refresh]'), 'click', async () => {
    const button = $('[data-refresh]'); button.disabled = true;
    const saved = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 10000); timers.add(timer);
      window.dispatchEvent(new CustomEvent('intake:flush', { detail: { done: result => { clearTimeout(timer); timers.delete(timer); resolve(result); } } }));
    });
    if (disposed) return;
    if (!saved || !waiting) { button.disabled = false; showError('A mentés nem sikerült. Exportálj biztonsági másolatot a frissítés előtt.'); return; }
    listen(navigator.serviceWorker, 'controllerchange', () => window.location.reload());
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  if (!production) $('[data-ready]').textContent = 'Az offline mód a kész, éles verzióban működik.';
  else if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(r => {
      if (disposed) return;
      registration = r;
      if (r.waiting) { waiting = r.waiting; $('[data-update]').classList.remove('hidden'); }
      if (r.active) verify();
      listen(r, 'updatefound', watch); watch();
    }).catch(() => { if (!disposed) $('[data-ready]').textContent = 'Az offline előkészítés nem sikerült.'; });
  } else $('[data-ready]').textContent = 'Ebben a böngészőben az offline megnyitás nem támogatott.';
  return () => { disposed = true; abort.abort(); timers.forEach(clearTimeout); };
}
