export class VisibleViewSession {
  constructor({ request, now = Date.now }) { this.request = request; this.now = now; this.current = null; }
  async start() {
    if (this.current) {
      if (this.current.active) return;
      this.current.active = true;
      this.current.visibleSince = this.now();
      return this.send(this.current, 'heartbeat');
    }
    const session = { visibleSince: this.now(), elapsed: 0, key: '', active: true };
    this.current = session;
    try {
      const result = await this.request('start', { durationMs: 0 });
      session.key = result?.sessionKey || '';
      if (!session.key && this.current === session) this.current = null;
      if (session.key && !session.active) await this.send(session, 'end');
    } catch { if (this.current === session) this.current = null; }
  }
  async send(session, action) {
    if (!session.key) return;
    try {
      const durationMs = session.elapsed + (session.active ? Math.max(0, this.now() - session.visibleSince) : 0);
      await this.request(action, { sessionKey: session.key, durationMs });
    } catch { /* Presence expires if a heartbeat cannot be delivered. */ }
  }
  heartbeat() { return !this.current ? this.start() : this.current.active ? this.send(this.current, 'heartbeat') : undefined; }
  end() {
    const session = this.current;
    if (!session?.active) return;
    session.elapsed += Math.max(0, this.now() - session.visibleSince);
    session.active = false;
    return this.send(session, 'end');
  }
}
