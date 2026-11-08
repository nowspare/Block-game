// Inventory and hotbar state.
// Creative/free: all blocks available, no counting.
// Survival: tracks per-block counts; breaking adds, placing subtracts.

import { HOTBAR_BLOCKS, ALL_PLACEABLE, BLOCK_DATA } from './blocks.js';

export class Inventory {
  constructor() {
    this.hotbar = [...HOTBAR_BLOCKS];
    this.selected = 0;
    this.counts = new Map(); // blockId -> count (survival only)
    this.mode = 'creative';
    this.listeners = new Set();
  }

  set_mode(mode) {
    this.mode = mode;
    if (mode === 'survival') {
      // starter pack
      this.counts.clear();
      this.counts.set(this.hotbar[0], 32);
      this.counts.set(this.hotbar[1], 16);
    } else {
      this.counts.clear();
    }
    this._emit();
  }

  current_block() {
    return this.hotbar[this.selected] ?? 0;
  }

  select(index) {
    if (index < 0 || index >= this.hotbar.length) return;
    this.selected = index;
    this._emit();
  }

  cycle(direction) {
    const n = this.hotbar.length;
    this.selected = ((this.selected + direction) % n + n) % n;
    this._emit();
  }

  count_of(blockId) {
    if (this.mode !== 'survival') return Infinity;
    return this.counts.get(blockId) ?? 0;
  }

  has_block(blockId) {
    if (this.mode !== 'survival') return true;
    return this.count_of(blockId) > 0;
  }

  add_block(blockId, amount = 1) {
    if (this.mode !== 'survival') return;
    const cur = this.count_of(blockId);
    this.counts.set(blockId, cur + amount);
    this._emit();
  }

  remove_block(blockId, amount = 1) {
    if (this.mode !== 'survival') return true;
    const cur = this.count_of(blockId);
    if (cur < amount) return false;
    this.counts.set(blockId, cur - amount);
    this._emit();
    return true;
  }

  // Update inventory to include all placeable blocks (survival fully unlocked).
  all_blocks() {
    return ALL_PLACEABLE;
  }

  block_name(id) {
    return BLOCK_DATA[id]?.name ?? 'Unknown';
  }

  on_change(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this);
  }
}
