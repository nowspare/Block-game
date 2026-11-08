// DOM wiring: menus, dialogs, HUD, hotbar, inventory screen.

import { BLOCK_DATA, ALL_PLACEABLE, HOTBAR_BLOCKS } from './blocks.js';
import { tile_data_url } from './textures.js';

export class UI {
  constructor(game) {
    this.game = game;
    this._cache = {};
    this._bind();
  }

  _el(id) {
    if (!this._cache[id]) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  }

  show_screen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    if (id) this._el(id)?.classList.add('active');
  }

  hide_screen(id) {
    this._el(id)?.classList.remove('active');
  }

  show_hud(show) {
    const hud = this._el('game-hud');
    if (!hud) return;
    hud.classList.toggle('hidden', !show);
  }

  set_loading(progress, text) {
    const fill = this._el('loading-fill');
    const label = this._el('loading-text');
    if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
    if (label && text) label.textContent = text;
  }

  _bind() {
    // Main menu
    this._el('btn-play')?.addEventListener('click', () => {
      this.game.sound.click();
      this.show_screen('new-world-dialog');
    });
    this._el('btn-load')?.addEventListener('click', () => {
      this.game.sound.click();
      this._render_world_list();
      this.show_screen('load-dialog');
    });
    this._el('btn-settings')?.addEventListener('click', () => {
      this.game.sound.click();
      this._open_settings();
    });
    this._el('btn-fullscreen')?.addEventListener('click', () => {
      this.game.sound.click();
      this._toggle_fullscreen();
    });

    // New world
    this._el('btn-create')?.addEventListener('click', () => this._create_world());
    this._el('btn-cancel-new')?.addEventListener('click', () => {
      this.game.sound.click();
      this.show_screen('main-menu');
    });

    // Load world
    this._el('btn-load-close')?.addEventListener('click', () => {
      this.game.sound.click();
      this.show_screen('main-menu');
    });

    // Settings
    this._el('btn-settings-close')?.addEventListener('click', () => {
      this.game.sound.click();
      this._close_settings();
    });
    this._el('btn-settings-game')?.addEventListener('click', () => {
      this.game.sound.click();
      this._open_settings();
    });

    // Settings controls
    this._bind_range('sens-input', 'sens-value', 'sensitivity', 1);
    this._bind_range('render-input', 'render-value', 'renderDistance', 1);
    this._bind_range('vol-input', 'vol-value', 'volume', 2);
    this._bind_range('fov-input', 'fov-value', 'fov', 0);
    this._bind_checkbox('shadow-input', 'shadows');

    // Pause menu
    this._el('btn-resume')?.addEventListener('click', () => {
      this.game.sound.click();
      this.game.resume_game();
    });
    this._el('btn-save')?.addEventListener('click', () => {
      this.game.sound.click();
      this.game.save_world();
    });
    this._el('btn-quit')?.addEventListener('click', () => {
      this.game.sound.click();
      this.game.quit_to_menu();
    });

    // Inventory screen
    this._el('btn-inv-close')?.addEventListener('click', () => {
      this.game.sound.click();
      this.game.close_inventory();
    });

    // Mobile action buttons
    this._el('mob-jump')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.game.controls.state.jump = true;
    });
    this._el('mob-jump')?.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.game.controls.state.jump = false;
    });
    this._el('mob-place')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.game.place_block();
    });
    this._el('mob-break')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.game.break_block();
    });
  }

  _bind_range(input_id, value_id, setting_key, decimals) {
    const input = this._el(input_id);
    const value = this._el(value_id);
    if (!input) return;

    const initial = this.game.settings.get(setting_key);
    input.value = initial;
    if (value) value.textContent = Number(initial).toFixed(decimals);

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (value) value.textContent = v.toFixed(decimals);
      this.game.settings.set(setting_key, v);
      this.game.apply_settings();
    });
  }

  _bind_checkbox(input_id, setting_key) {
    const input = this._el(input_id);
    if (!input) return;
    input.checked = this.game.settings.get(setting_key);
    input.addEventListener('change', () => {
      this.game.settings.set(setting_key, input.checked);
      this.game.apply_settings();
    });
  }

  _open_settings() {
    // Sync controls with current values
    const s = this.game.settings;
    this._el('sens-input').value = s.get('sensitivity');
    this._el('sens-value').textContent = Number(s.get('sensitivity')).toFixed(1);
    this._el('render-input').value = s.get('renderDistance');
    this._el('render-value').textContent = s.get('renderDistance');
    this._el('vol-input').value = s.get('volume');
    this._el('vol-value').textContent = Number(s.get('volume')).toFixed(2);
    this._el('fov-input').value = s.get('fov');
    this._el('fov-value').textContent = s.get('fov');
    this._el('shadow-input').checked = s.get('shadows');

    this.show_screen('settings-dialog');
  }

  _close_settings() {
    if (this.game.is_playing()) {
      this.show_screen('pause-menu');
    } else {
      this.show_screen('main-menu');
    }
  }

  async _create_world() {
    const seed_input = this._el('seed-input').value.trim();
    const mode = this._el('mode-select').value;
    let seed = 0;
    if (seed_input) {
      // String hash → int
      let h = 0;
      for (let i = 0; i < seed_input.length; i++) {
        h = (h * 31 + seed_input.charCodeAt(i)) | 0;
      }
      seed = h;
    } else {
      seed = Math.floor(Math.random() * 1000000);
    }

    this._el('seed-input').value = '';
    this.game.sound.click();

    // World id
    const id = this.game.save_system.generate_id();
    const name = seed_input || `World ${id.slice(-4)}`;

    await this.game.start_world({ id, name, seed, mode });
  }

  _render_world_list() {
    const list = this._el('world-list');
    if (!list) return;
    list.innerHTML = '';

    const worlds = this.game.save_system.list();
    if (worlds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'world-empty';
      empty.textContent = 'No saved worlds yet. Create one from the Play menu.';
      list.appendChild(empty);
      return;
    }

    for (const w of worlds) {
      const item = document.createElement('div');
      item.className = 'world-item';

      const info = document.createElement('div');
      info.className = 'world-item-info';

      const name = document.createElement('div');
      name.className = 'world-item-name';
      name.textContent = w.name;

      const meta = document.createElement('div');
      meta.className = 'world-item-meta';
      const date = new Date(w.timestamp).toLocaleString();
      meta.textContent = `${w.mode} · seed ${w.seed} · ${w.modified} changes · ${date}`;

      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'world-item-actions';

      const load_btn = document.createElement('button');
      load_btn.textContent = 'Load';
      load_btn.addEventListener('click', async () => {
        this.game.sound.click();
        const data = this.game.save_system.load(w.id);
        if (data) {
          await this.game.start_world({
            id: w.id,
            name: data.name,
            seed: data.seed,
            mode: data.mode,
            player_data: data.player,
            changes: data.changes,
          });
        }
      });

      const del_btn = document.createElement('button');
      del_btn.textContent = 'Delete';
      del_btn.addEventListener('click', () => {
        if (confirm(`Delete "${w.name}"?`)) {
          this.game.save_system.delete(w.id);
          this._render_world_list();
        }
      });

      actions.appendChild(load_btn);
      actions.appendChild(del_btn);

      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    }
  }

  _toggle_fullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }

  // ---- Hotbar ----

  build_hotbar() {
    const hotbar = this._el('hotbar');
    if (!hotbar) return;
    hotbar.innerHTML = '';

    const inv = this.game.inventory;
    for (let i = 0; i < HOTBAR_BLOCKS.length; i++) {
      const block_id = inv.hotbar[i];
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = String(i);

      const num = document.createElement('div');
      num.className = 'slot-num';
      num.textContent = String(i + 1);

      const icon = document.createElement('div');
      icon.className = 'block-icon';
      const tile_name = BLOCK_DATA[block_id]?.tiles?.top || 'stone';
      icon.style.backgroundImage = `url(${tile_data_url(tile_name)})`;

      const count = document.createElement('div');
      count.className = 'slot-count';
      if (inv.mode === 'survival') {
        count.textContent = String(inv.count_of(block_id));
      }

      slot.appendChild(num);
      slot.appendChild(icon);
      if (inv.mode === 'survival') slot.appendChild(count);

      slot.addEventListener('click', () => {
        inv.select(i);
      });

      hotbar.appendChild(slot);
    }

    this.refresh_hotbar_selection();
  }

  refresh_hotbar_selection() {
    const hotbar = this._el('hotbar');
    if (!hotbar) return;
    const inv = this.game.inventory;
    for (let i = 0; i < hotbar.children.length; i++) {
      hotbar.children[i].classList.toggle('active', i === inv.selected);
    }

    // Update survival counts
    if (inv.mode === 'survival') {
      for (let i = 0; i < hotbar.children.length; i++) {
        const block_id = inv.hotbar[i];
        const count_el = hotbar.children[i].querySelector('.slot-count');
        if (count_el) count_el.textContent = String(inv.count_of(block_id));
      }
    }
  }

  // ---- Inventory screen ----

  build_inventory_grid() {
    const grid = this._el('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const inv = this.game.inventory;

    for (const block_id of ALL_PLACEABLE) {
      const data = BLOCK_DATA[block_id];
      const tile_name = data.tiles?.top || 'stone';
      const slot = document.createElement('div');
      slot.className = 'inv-slot';

      const icon = document.createElement('div');
      icon.className = 'block-icon';
      icon.style.backgroundImage = `url(${tile_data_url(tile_name)})`;

      const name = document.createElement('div');
      name.className = 'inv-name';
      name.textContent = data.name;

      slot.appendChild(icon);
      slot.appendChild(name);

      slot.addEventListener('click', () => {
        // Assign this block to the current hotbar slot
        const idx = inv.selected;
        inv.hotbar[idx] = block_id;
        this.build_hotbar();
        this.game.close_inventory();
      });

      grid.appendChild(slot);
    }
  }

  // ---- Game info ----

  update_game_info(player, world, mode) {
    const el = this._el('game-info');
    if (!el) return;
    const x = Math.floor(player.position.x);
    const y = Math.floor(player.position.y);
    const z = Math.floor(player.position.z);
    const t = Math.floor(this.game.lighting.time_of_day);
    const hours = String(t).padStart(2, '0');
    el.innerHTML = `
      <div class="info-line">XYZ <span>${x} ${y} ${z}</span></div>
      <div class="info-line">TIME <span>${hours}:00</span></div>
      <div class="info-line">MODE <span>${mode}</span></div>
    `;
  }
}
