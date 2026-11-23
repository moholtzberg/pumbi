<script>
  import { onMount } from 'svelte';
  import { AuctionStream } from '$lib/utils/auctionStream.js';

  let { auctionId, publisher = false, allowed = true, onlivechange = () => {} } = $props();
  let configured = $state(false);
  let checked = $state(false);
  let finished = $state(false);
  let busy = $state(false);
  let errorMessage = $state('');
  let soundEnabled = $state(false);
  let media = $state({ status: 'idle', video: null, audio: null, live: false, microphoneEnabled: true });
  let videoElement = $state(null);
  let audioElement = $state(null);
  let controller;
  let disposed = false;
  let checking = false;
  const endpoint = $derived(`/api/auctions/${auctionId}/stream`);

  $effect(() => { onlivechange(media.live); });
  $effect(() => {
    if (publisher && !allowed) controller?.disconnect();
  });
  $effect(() => {
    const track = media.video;
    if (!track || !videoElement) return;
    const element = videoElement;
    track.attach(element);
    element.play().catch(() => {});
    return () => { track.detach(element); };
  });
  $effect(() => {
    const track = media.audio;
    if (!track || !audioElement) return;
    const element = audioElement;
    track.attach(element);
    return () => { track.detach(element); };
  });

  async function getController() {
    if (!controller) {
      const sdk = await import('livekit-client');
      if (disposed) return null;
      controller = new AuctionStream({ sdk, endpoint, onChange: state => { if (!disposed) media = state; } });
    }
    return controller;
  }

  async function run(action) {
    if (busy || disposed) return;
    busy = true;
    errorMessage = '';
    try {
      const stream = await getController();
      if (!stream || disposed) return;
      if (action === 'preview') await stream.preview();
      if (action === 'start') await stream.connect(true);
      if (action === 'watch') await stream.connect(false);
      if (action === 'mute') await stream.toggleMicrophone();
      if (action === 'stop') {
        stream.disconnect();
        // Revoke the publisher connection on the server as well.
        const response = await fetch(endpoint, { method: 'DELETE' });
        if (!response.ok) throw new Error('Camera stopped locally. Unable to confirm the stream stopped on the server.');
      }
    } catch (err) {
      if (!disposed) errorMessage = err.name === 'NotAllowedError'
        ? 'Allow camera and microphone access in your browser, then try again.'
        : err.name === 'NotFoundError' ? 'No camera or microphone was found. Connect a device and try again.'
        : err.message || 'Unable to connect to live video';
    } finally { if (!disposed) busy = false; }
  }

  async function checkStatus() {
    if (checking || disposed) return;
    checking = true;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to check the live video connection');
      const status = await response.json();
      if (disposed) return;
      configured = status.configured;
      finished = status.finished;
      checked = true;
      if (!configured || finished) errorMessage = '';
      if (finished || !configured || (publisher && controller?.publisherUserId && status.auctioneerId !== controller.publisherUserId)) {
        controller?.disconnect();
        return;
      }
      if (!publisher && !controller?.room && !busy) await run('watch');
    } catch (err) { if (!disposed) { checked = true; errorMessage = err.message; } }
    finally { checking = false; }
  }

  async function enableSound() {
    try {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        await controller?.room?.startAudio();
        await audioElement?.play();
      }
    } catch { soundEnabled = false; errorMessage = 'Your browser paused audio. Click Enable sound to try again.'; }
  }

  onMount(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 15000);
    return () => { disposed = true; clearInterval(timer); controller?.disconnect(); };
  });
</script>

{#if publisher || (configured && !finished) || errorMessage}
  <section class="overflow-hidden border border-[var(--pumbi-line)] bg-[var(--pumbi-forest-deep)] text-[#f7f4ee]" aria-label={publisher ? 'Broadcast live video' : 'Live auction video'}>
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <h2 class="font-semibold">{publisher ? 'Auctioneer live video' : 'Live auction video'}</h2>
        <p class="mt-1 text-xs text-[#bec9c4]" role="status">
          {#if finished}This auction has ended.
          {:else if !checked}Checking live video…
          {:else if !configured}Live video is not configured for this site yet. Contact your administrator.
          {:else if media.status === 'reconnecting'}Reconnecting to live video…
          {:else if media.status === 'connecting'}Connecting…
          {:else if media.live}● LIVE{publisher ? ' · Your camera and microphone are being broadcast.' : ''}
          {:else if publisher && media.status === 'preview'}Preview only. Click Go live to broadcast to viewers.
          {:else if publisher}Preview your camera, then go live for everyone on the auction page.
          {:else}The auctioneer’s video will start here automatically when they go live.{/if}
        </p>
      </div>
      {#if !publisher && media.live}
        <button type="button" class="border border-white/30 px-3 py-2 text-sm" onclick={enableSound}>{soundEnabled ? 'Mute sound' : 'Enable sound'}</button>
      {/if}
    </div>
    <div class:hidden={!media.video} class="aspect-video bg-black">
      <video bind:this={videoElement} autoplay playsinline muted aria-label={publisher ? 'Your camera preview' : 'Live auctioneer video'} class="h-full w-full object-contain"></video>
    </div>
    <audio bind:this={audioElement} autoplay muted={!soundEnabled} aria-label="Live auctioneer audio"></audio>
    {#if errorMessage}<p role="alert" class="px-4 py-3 text-sm text-red-200">{errorMessage}</p>{/if}
    {#if publisher && configured && !finished}
      <div class="flex flex-wrap gap-2 border-t border-white/15 px-4 py-3">
        {#if media.status === 'idle'}
          <button type="button" class="pumbi-btn" disabled={busy || !allowed} onclick={() => run('preview')}>{busy ? 'Opening camera…' : 'Preview camera & microphone'}</button>
        {:else}
          {#if media.status === 'preview'}<button type="button" class="pumbi-btn" disabled={busy || !allowed} onclick={() => run('start')}>{busy ? 'Connecting…' : 'Go live'}</button>{/if}
          <button type="button" class="border border-white/30 px-3 py-2 text-sm" disabled={busy} onclick={() => run('mute')}>{media.microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}</button>
          <button type="button" class="border border-white/30 px-3 py-2 text-sm" disabled={busy} onclick={() => media.status === 'preview' ? controller?.disconnect() : run('stop')}>{media.status === 'preview' ? 'Close preview' : 'Stop broadcast'}</button>
        {/if}
        {#if !allowed}<p class="w-full text-sm text-[#bec9c4]">Claim the auctioneer seat to broadcast.</p>{/if}
      </div>
    {/if}
  </section>
{/if}
