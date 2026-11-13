"use client";
import { useEffect, useState } from 'react';
export default function MobileSupport() {
  const [online, setOnline] = useState(true);
  const [offlineState, setOfflineState] = useState('loading');
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true, registration, worker;
    const install = e => { e.preventDefault(); setPromptEvent(e); };
    const installedHandler = () => { setInstalled(true); setPromptEvent(null); };
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) registration?.update().catch(() => {}); };
    setOnline(navigator.onLine);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installedHandler);
    async function verify() {
      const active = registration?.active;
      if (!active) return;
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { if (alive) setOfflineState('error'); }, 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout); channel.port1.close();
        if (alive) setOfflineState(event.data?.ready ? 'ready' : 'error');
      };
      active.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
    }
    function stateChanged() {
      if (!alive) return;
      if (worker?.state === 'installed' && registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
      if (worker?.state === 'activated') verify();
      if (worker?.state === 'redundant' && !registration.active) setOfflineState('error');
    }
    function found() { worker = registration.installing; worker?.addEventListener('statechange', stateChanged); }
    if (process.env.NODE_ENV !== 'production') setOfflineState('development');
    else if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(r => {
        if (!alive) return;
        registration = r;
        if (r.waiting) setWaiting(r.waiting);
        if (r.active) verify();
        r.addEventListener('updatefound', found); found();
      }).catch(() => { if (alive) setOfflineState('error'); });
    } else setOfflineState('unsupported');
    return () => {
      alive = false;
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installedHandler);
      registration?.removeEventListener('updatefound', found); worker?.removeEventListener('statechange', stateChanged);
    };
  }, []);
  async function doInstall() {
    if (!promptEvent) return;
    try { await promptEvent.prompt(); await promptEvent.userChoice; } finally { setPromptEvent(null); }
  }
  async function update() {
    setBusy(true); setError('');
    const saved = await new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), 10000);
      window.dispatchEvent(new CustomEvent('intake:flush', { detail: { done: result => { clearTimeout(timeout); resolve(result); } } }));
    });
    if (!saved) { setError('A mentés nem sikerült. Exportálj biztonsági másolatot, és csak utána frissíts.'); setBusy(false); return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
  const status = { loading: 'Offline előkészítés folyamatban…', ready: 'Offline használatra kész', error: 'Az offline előkészítés nem sikerült. Internet mellett nyisd meg újra az appot.', unsupported: 'Ebben a böngészőben az offline megnyitás nem támogatott.', development: 'Az offline mód a kész, éles verzióban működik.' };
  return <aside className="mobile-support" aria-label="Telefonos használat">
    <div className="mobile-status" role="status"><span className={online ? 'network-online' : 'network-offline'}>{online ? '● Internetkapcsolat elérhető' : '● Nincs internetkapcsolat'}</span><span>{status[offlineState]}</span></div>
    {waiting && <div className="update-notice"><span>Új alkalmazásverzió érhető el. Frissítés előtt elmentjük a felvételt.</span><button disabled={busy} onClick={update}>{busy ? 'Mentés és frissítés…' : 'Mentés és frissítés'}</button></div>}
    {error && <p role="alert">{error}</p>}
    {!installed && <details className="install-help"><summary>Telepítés telefonra · Android és iPhone</summary><div className="install-columns"><div><h3>Android</h3><p>Chrome-ban válaszd a menüben a „Telepítés” vagy a „Hozzáadás a kezdőképernyőhöz” lehetőséget.</p>{promptEvent && <button className="primary" onClick={doInstall}>Alkalmazás telepítése</button>}</div><div><h3>iPhone</h3><p>Nyisd meg Safariban, majd Megosztás → Főképernyőhöz adás → Hozzáadás.</p></div></div><p className="muted">Az első megnyitáshoz internet szükséges. Az offline használat előtt várd meg az „Offline használatra kész” jelzést. A felvételek ezen a készüléken maradnak; a telefonok között nincs automatikus szinkron.</p></details>}
  </aside>;
}
