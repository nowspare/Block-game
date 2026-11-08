// World persistence via localStorage.
// Stores: seed, mode, player state, block modifications.

const STORAGE_KEY = 'blockforge.worlds.v1';

export class SaveSystem {
  constructor() {
    this.worlds = this._read();
  }

  _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  _write() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.worlds));
    } catch (e) {
      console.error('Failed to save worlds:', e);
    }
  }

  list() {
    return Object.entries(this.worlds).map(([id, w]) => ({
      id,
      name: w.name,
      seed: w.seed,
      mode: w.mode,
      modified: w.modified,
      timestamp: w.timestamp,
    })).sort((a, b) => b.timestamp - a.timestamp);
  }

  save(id, { name, seed, mode, player, changes }) {
    this.worlds[id] = {
      name,
      seed,
      mode,
      player: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch },
      changes: Array.from(changes.entries()),
      modified: changes.size,
      timestamp: Date.now(),
    };
    this._write();
  }

  load(id) {
    const w = this.worlds[id];
    if (!w) return null;
    return {
      name: w.name,
      seed: w.seed,
      mode: w.mode,
      player: w.player,
      changes: new Map(w.changes || []),
    };
  }

  delete(id) {
    delete this.worlds[id];
    this._write();
  }

  generate_id() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
}
