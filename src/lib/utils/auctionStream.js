// LiveKit owns media transport; this controller owns browser track lifetime.
export class AuctionStream {
  constructor({ sdk, endpoint, onChange, fetcher = fetch }) {
    this.sdk = sdk;
    this.endpoint = endpoint;
    this.onChange = onChange;
    this.fetcher = fetcher;
    this.generation = 0;
    this.tracks = [];
    this.room = null;
    this.publisherUserId = null;
    this.state = { status: 'idle', video: null, audio: null, live: false, microphoneEnabled: true };
  }

  change(patch) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  async preview() {
    const generation = ++this.generation;
    const tracks = await this.sdk.createLocalTracks({ video: { resolution: { width: 1280, height: 720 } }, audio: true });
    if (generation !== this.generation) { tracks.forEach(track => track.stop()); return; }
    this.tracks = tracks;
    const video = tracks.find(track => track.kind === 'video');
    this.change({ status: 'preview', video, microphoneEnabled: true });
    video?.mediaStreamTrack.addEventListener('ended', () => this.disconnect(), { once: true });
  }

  async connect(publisher = false) {
    if (publisher && !this.tracks.length) await this.preview();
    // A preview may have been canceled while the permission dialog was open.
    if (publisher && !this.tracks.length) return;
    const generation = ++this.generation;
    this.change({ status: 'connecting' });
    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: publisher ? 'publisher' : 'viewer' })
      });
      const credentials = await response.json();
      if (!response.ok) throw new Error(credentials.message || 'Unable to connect to live video');
      if (generation !== this.generation) return;
      this.publisherUserId = credentials.publisherUserId;
      const { Room, RoomEvent, Track } = this.sdk;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      const current = () => generation === this.generation;
      if (!publisher) {
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (!current() || participant.identity !== credentials.broadcasterIdentity) return;
          if (publication.source === Track.Source.Camera) this.change({ video: track, live: !publication.isMuted, status: 'connected' });
          if (publication.source === Track.Source.Microphone) this.change({ audio: track });
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (!current()) return;
          if (this.state.video === track) this.change({ video: null, live: false, status: 'waiting' });
          if (this.state.audio === track) this.change({ audio: null });
        });
        room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (current() && participant.identity === credentials.broadcasterIdentity && publication.source === Track.Source.Camera) this.change({ live: false });
        });
        room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (current() && participant.identity === credentials.broadcasterIdentity && publication.source === Track.Source.Camera) this.change({ live: true });
        });
      }
      room.on(RoomEvent.Reconnecting, () => { if (current()) this.change({ status: 'reconnecting' }); });
      room.on(RoomEvent.Reconnected, () => { if (current()) this.change({ status: publisher ? 'live' : this.state.live ? 'connected' : 'waiting' }); });
      room.on(RoomEvent.Disconnected, () => { if (current()) this.disconnect(); });
      await room.connect(credentials.url, credentials.token, { autoSubscribe: !publisher });
      if (!current()) { await room.disconnect(); return; }
      if (publisher) {
        for (const track of this.tracks) {
          if (!current()) return;
          await room.localParticipant.publishTrack(track);
        }
        if (current()) this.change({ status: 'live', live: true });
      } else if (!this.state.video) {
        this.change({ status: 'waiting' });
      }
    } catch (err) {
      if (generation !== this.generation) return;
      this.disconnect();
      throw err;
    }
  }

  async toggleMicrophone() {
    const track = this.tracks.find(track => track.kind === 'audio');
    if (!track) return;
    const enabled = !this.state.microphoneEnabled;
    if (enabled) await track.unmute(); else await track.mute();
    this.change({ microphoneEnabled: enabled });
  }

  disconnect() {
    ++this.generation;
    const room = this.room;
    this.room = null;
    this.publisherUserId = null;
    this.tracks.forEach(track => track.stop());
    this.tracks = [];
    if (room) void room.disconnect();
    this.change({ status: 'idle', video: null, audio: null, live: false });
  }
}
