export function stepPath(points, x, y, field) {
  return points.map((point, index) => index === 0
    ? `M${x(point.time)},${y(point[field])}`
    : `H${x(point.time)}V${y(point[field])}`).join(' ');
}

export function chartPoints(history, { startingBid = 0, now = new Date(), finished = false } = {}) {
  if (!history.length) return [];
  const first = history[0];
  const last = history.at(-1);
  const baselineTime = new Date(new Date(first.firstAt || first.time).getTime() - 1000).toISOString();
  const end = finished ? new Date(last.time).getTime() + 1000 : Math.max(new Date(last.time).getTime() + 1000, new Date(now).getTime());
  return [
    { time: baselineTime, price: Number(startingBid), bids: 0, bidders: 0 },
    ...history,
    { ...last, time: new Date(end).toISOString() }
  ];
}
