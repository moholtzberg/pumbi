<script>
  /**
   * Branded Pumbi loading mark — terracotta "P" gently zooms in/out.
   * @type {{ size?: 'sm' | 'md' | 'lg'; label?: string; class?: string }}
   */
  let { size = 'md', label = 'Loading', class: className = '' } = $props();

  const sizes = {
    sm: 28,
    md: 44,
    lg: 64
  };
  const px = sizes[size] ?? sizes.md;
  const fontPx = Math.round(px * 0.68);
</script>

<div class="pumbi-loader {className}" role="status" aria-live="polite" aria-label={label}>
  <span
    class="pumbi-loader__mark"
    style="width: {px}px; height: {px}px; font-size: {fontPx}px;"
    aria-hidden="true"
  >P</span>
  <span class="sr-only">{label}</span>
</div>

<style>
  .pumbi-loader {
    display: inline-grid;
    place-items: center;
  }

  .pumbi-loader__mark {
    display: grid;
    place-items: center;
    background: #a95739;
    color: #fff;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-weight: 400;
    line-height: 1;
    user-select: none;
    transform-origin: center center;
    animation: pumbi-loader-pulse 1.15s ease-in-out infinite;
  }

  @keyframes pumbi-loader-pulse {
    0%,
    100% {
      transform: scale(0.88);
    }
    50% {
      transform: scale(1.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pumbi-loader__mark {
      animation: none;
      transform: scale(1);
      opacity: 0.85;
    }
  }
</style>
