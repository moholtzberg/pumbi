<script>
  import { page as localePage } from '$app/stores';
  import { translate as translateUi } from '$lib/i18n.js';
  const ui = (text, values) => translateUi($localePage.data.locale || 'en', text, values);

  import { onMount, onDestroy } from 'svelte';
  
  let {
    targetDate,
    label = 'Starting in'
  } = $props();
  
  let timeRemaining = $state({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  let intervalId = null;
  
  function calculateTimeRemaining() {
    if (!targetDate) return;
    
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const difference = target - now;
    
    if (difference <= 0) {
      timeRemaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return;
    }
    
    timeRemaining = {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((difference % (1000 * 60)) / 1000)
    };
  }
  
  onMount(() => {
    calculateTimeRemaining();
    intervalId = setInterval(calculateTimeRemaining, 1000);
  });
  
  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
  
  function formatTime() {
    const parts = [];
    if (timeRemaining.days > 0) {
      parts.push(ui('{count}d', { count: timeRemaining.days }));
    }
    if (timeRemaining.hours > 0 || timeRemaining.days > 0) {
      parts.push(ui('{count}h', { count: timeRemaining.hours }));
    }
    if (timeRemaining.minutes > 0 || timeRemaining.hours > 0 || timeRemaining.days > 0) {
      parts.push(ui('{count}m', { count: timeRemaining.minutes }));
    }
    parts.push(ui('{count}s', { count: timeRemaining.seconds }));
    return parts.join(' ');
  }
</script>

{#if targetDate}
  {#if label}
    <div class="text-sm">
      <p class="text-gray-500">{ui(label)}</p>
      <p class="font-semibold text-blue-600">{formatTime()}</p>
    </div>
  {:else}
    <span>{formatTime()}</span>
  {/if}
{/if}

