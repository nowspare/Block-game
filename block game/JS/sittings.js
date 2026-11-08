// User settings, persisted in localStorage.

const STORAGE_KEY = 'blockforge.settings.v1';

const DEFAULTS = {
  sensitivity: 1.0,
  renderDistance: 5,
  volume: 0.6,
  fov: 75,
  shadows: true,
  invertY: false,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.values = { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      // ignore corrupt settings, keep defaults
    }
    return this.values;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch (e) {
      // storage may be full / disabled — non-fatal
    }
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    this.save();
    return value;
  }
}
