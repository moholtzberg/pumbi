export function loginDestination(value, origin) {
  if (typeof value !== 'string' || !value) return '/dashboard';
  try {
    const destination = new URL(value, origin);
    if (destination.origin === origin) return destination.pathname + destination.search + destination.hash;
  } catch { /* Invalid destinations fall back to the dashboard. */ }
  return '/dashboard';
}
