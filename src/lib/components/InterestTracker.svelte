<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  /** @type {{ entityType: 'AUCTION' | 'LOT'; entityId: string }} */
  let { entityType, entityId } = $props();

  const STORAGE_KEY = 'pumbi_vid';
  let sessionKey = '';
  let startedAt = 0;
  let accumulatedMs = 0;
  let visibleSince = 0;
  let heartbeatTimer;
  let flushed = false;

  function getAnonId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      return `tmp_${Math.random().toString(36).slice(2)}`;
    }
  }

  function visibleDuration() {
    const live = visibleSince ? Date.now() - visibleSince : 0;
    return accumulatedMs + live;
  }

  function send(action, { keepalive = false } = {}) {
    if (!sessionKey && action !== 'start') return;
    const payload = {
      action,
      entityType,
      entityId,
      anonId: getAnonId(),
      sessionKey,
      durationMs: visibleDuration(),
      path: browser ? window.location.pathname : null,
      referrer: browser ? document.referrer || null : null
    };

    return fetch('/api/analytics/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      keepalive
    }).catch(() => {});
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (visibleSince) {
        accumulatedMs += Date.now() - visibleSince;
        visibleSince = 0;
      }
      send('heartbeat', { keepalive: true });
    } else if (!visibleSince) {
      visibleSince = Date.now();
    }
  }

  function onPageHide() {
    if (flushed) return;
    flushed = true;
    if (visibleSince) {
      accumulatedMs += Date.now() - visibleSince;
      visibleSince = 0;
    }
    send('end', { keepalive: true });
  }

  onMount(() => {
    if (!entityType || !entityId) return;
    startedAt = Date.now();
    visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;

    send('start')?.then?.(async (response) => {
      if (!response?.ok) return;
      const data = await response.json().catch(() => ({}));
      sessionKey = data.sessionKey || '';
    });

    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') send('heartbeat');
    }, 15000);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
  });

  onDestroy(() => {
    clearInterval(heartbeatTimer);
    if (!browser) return;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    onPageHide();
  });
</script>
