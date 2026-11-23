<script>
  import { browser } from '$app/environment';
  import { VisibleViewSession } from '$lib/utils/viewSession.js';

  let { entityType, entityId } = $props();
  let fallbackId;
  function visitorId() {
    try {
      let id = localStorage.getItem('pumbi_vid');
      if (!id) { id = crypto.randomUUID(); localStorage.setItem('pumbi_vid', id); }
      return id;
    } catch { return fallbackId ||= crypto.randomUUID(); }
  }

  $effect(() => {
    const type = entityType, id = entityId;
    if (!browser || !type || !id) return;
    const anonId = visitorId();
    const session = new VisibleViewSession({
      request: async (action, payload) => {
        const response = await fetch('/api/analytics/view', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          keepalive: action === 'end',
          body: JSON.stringify({ action, entityType: type, entityId: id, anonId, path: window.location.pathname, referrer: document.referrer || null, ...payload })
        });
        if (!response.ok) throw new Error('Unable to record view');
        return response.json();
      }
    });
    const visibility = () => document.visibilityState === 'visible' ? session.start() : session.end();
    const leave = () => session.end();
    visibility();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') session.heartbeat(); }, 15000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', visibility);
      session.end();
    };
  });
</script>
