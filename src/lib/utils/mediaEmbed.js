/**
 * Convert a YouTube / Vimeo / generic HTTPS media URL into an embeddable iframe src.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function mediaEmbedUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname.startsWith('/embed/')) return `https://www.youtube.com${parsed.pathname}`;
      const fromWatch = parsed.searchParams.get('v');
      if (fromWatch) return `https://www.youtube.com/embed/${fromWatch}`;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['live', 'shorts', 'v'].includes(parts[0])) {
        return `https://www.youtube.com/embed/${parts[1]}`;
      }
      return null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}
