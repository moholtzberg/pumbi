import prisma from '$lib/prisma.js';

function buildCorrelations(events) {
  const groups = new Map();

  function add(type, key, label, event) {
    if (!key || !event.user) return;
    const groupKey = `${type}:${key}`;
    const group = groups.get(groupKey) || {
      type,
      label,
      users: new Map(),
      loginCount: 0,
      lastSeen: event.createdAt
    };
    group.users.set(event.user.id, event.user);
    group.loginCount += 1;
    if (event.createdAt > group.lastSeen) group.lastSeen = event.createdAt;
    groups.set(groupKey, group);
  }

  for (const event of events) {
    add('Device', event.deviceIdHash, event.deviceIdHash ? `Device …${event.deviceIdHash.slice(-10)}` : null, event);
    add('IP address', event.ipHash, event.ipAddress, event);
  }

  return [...groups.values()]
    .filter((group) => group.users.size > 1)
    .map((group) => ({ ...group, users: [...group.users.values()] }))
    .sort((a, b) => b.users.length - a.users.length || b.lastSeen - a.lastSeen)
    .slice(0, 100);
}

export async function load({ url }) {
  const search = url.searchParams.get('q')?.trim() || '';
  const outcome = url.searchParams.get('outcome') || '';
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const userSelect = { id: true, email: true, name: true, role: true };
  const filter = {
    ...(outcome ? { outcome } : {}),
    ...(search ? {
      OR: [
        { attemptedEmail: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
        { city: { contains: search, mode: 'insensitive' } },
        { countryCode: { contains: search, mode: 'insensitive' } },
        { user: { is: { email: { contains: search, mode: 'insensitive' } } } }
      ]
    } : {})
  };

  const [events, correlationEvents, successes, failures] = await prisma.$transaction([
    prisma.loginSecurityEvent.findMany({
      where: filter,
      take: 250,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: userSelect } }
    }),
    prisma.loginSecurityEvent.findMany({
      where: { outcome: 'SUCCESS', createdAt: { gte: since }, userId: { not: null } },
      take: 5000,
      orderBy: { createdAt: 'desc' },
      select: {
        deviceIdHash: true, ipHash: true, ipAddress: true, createdAt: true,
        user: { select: userSelect }
      }
    }),
    prisma.loginSecurityEvent.count({ where: { outcome: 'SUCCESS', createdAt: { gte: since } } }),
    prisma.loginSecurityEvent.count({ where: { outcome: 'FAILURE', createdAt: { gte: since } } })
  ]);

  const correlations = buildCorrelations(correlationEvents);
  return {
    events,
    correlations,
    metrics: {
      successes,
      failures,
      sharedIdentifiers: correlations.length,
      distinctDevices: new Set(correlationEvents.map((event) => event.deviceIdHash).filter(Boolean)).size,
      distinctIps: new Set(correlationEvents.map((event) => event.ipHash).filter(Boolean)).size
    },
    filters: { search, outcome },
    windowDays: 90
  };
}
