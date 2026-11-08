// Orchestrator — owns scene, systems, game loop, and world lifecycle.

import * as THREE from 'three';
import { World, CHUNK_SIZE, WORLD_HEIGHT } from './world.js';
import { Player } from './player.js';
import { CameraController } from './camera.js';
import { Controls } from './controls.js';
import { Inventory } from './inventory.js';
import { Lighting } from './lighting.js';
import { SoundManager } from './sound.js';
import { Settings } from './settings.js';
import { SaveSystem } from './save-system.js';
import { raycast_voxel } from './physics.js';
import { BLOCK, BLOCK_DATA } from './blocks.js';

const RAY_MAX = 8;

export class Game {
  constructor(ui_callback) {
    this.settings = new Settings();
    this.sound = new SoundManager();
    this.sound.set_volume(this.settings.get('volume'));

    this.save_system = new SaveSystem();
    this.inventory = new Inventory();
    this.inventory.set_mode('creative');

    // Three.js core
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.lighting = new Lighting(this.scene);

    this.world = new World(this.scene);
    this.player = new Player(this.world);
    this.camera_ctl = new CameraController();
    this.controls = new Controls(this.renderer.domElement, this.settings);

    // Wire callbacks
    this._wire_callbacks();

    // State
    this.state = 'menu'; // 'menu' | 'loading' | 'playing' | 'paused' | 'inventory'
    this.current_world_id = null;
    this.current_world_name = null;
    this.mode = 'creative';

    // Timing
    this._last_time = performance.now();
    this._animating = false;

    // Highlight box for targeted block
    this._highlight = this._create_highlight_box();
    this.scene.add(this._highlight);

    // UI (loaded externally, wired after)
    this.ui = null;

    // Resize
    window.addEventListener('resize', () => this._on_resize());

    // Start render loop (for menus and game)
    this._start_loop();
  }

  set_ui(ui) {
    this.ui = ui;
    this.inventory.on_change(() => {
      this.ui?.refresh_hotbar_selection();
    });
  }

  _wire_callbacks() {
    this.controls.on_break = () => this.break_block();
    this.controls.on_place = () => this.place_block();
    this.controls.on_hotbar = (i) => {
      this.inventory.select(i);
    };
    this.controls.on_inventory = () => this.toggle_inventory();
    this.controls.on_pointerlock_change = (locked) => {
      if (!locked && this.state === 'playing') {
        this.pause_game();
      }
    };
    this.controls.on_land = () => this.sound.land();
  }

  _create_highlight_box() {
    const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
    const box = new THREE.LineSegments(edges, mat);
    box.visible = false;
    box.renderOrder = 999;
    return box;
  }

  _start_loop() {
    if (this._animating) return;
    this._animating = true;
    this._last_time = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this._last_time) / 1000);
      this._last_time = now;
      this._tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _tick(dt) {
    // Always update lighting (sky still animates in menu)
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'inventory') {
      this.lighting.update(dt);
    }

    // Update player only when actively playing
    if (this.state === 'playing' && this.controls.pointer_locked) {
      // Look
      const { dx, dy } = this.controls.consume_look();
      const sens = 0.0025 * this.settings.get('sensitivity');
      this.player.yaw -= dx * sens;
      this.player.pitch -= dy * sens;
      const max_pitch = Math.PI / 2 - 0.01;
      this.player.pitch = Math.max(-max_pitch, Math.min(max_pitch, this.player.pitch));

      // Hotbar wheel
      const wheel = this.controls.consume_wheel();
      if (wheel !== 0) this.inventory.cycle(wheel);

      // Movement
      this.player.update(dt, this.controls.state);

      // Update camera from player
      this.camera_ctl.update(this.player, dt);

      // Update highlight
      this._update_highlight();

      // UI updates
      this.ui?.update_game_info(this.player, this.world, this.mode);

      // Ensure chunks near player visible
      this._update_chunk_visibility();
    } else if (this.state === 'playing' && !this.controls.pointer_locked) {
      // Game is running but no pointer lock — still update camera for view continuity
      this.camera_ctl.update(this.player, dt);
    }

    // If playing but not focused, still update camera position once
    if (this.state === 'playing') {
      this.camera_ctl.update(this.player, dt);
    }

    // Render
    this.renderer.render(this.scene, this.camera_ctl.camera);
  }

  _update_highlight() {
    const eye = this.player.eye_position();
    const dir = this.player.look_direction();
    const hit = raycast_voxel(this.world, eye, dir, RAY_MAX);

    if (hit) {
      this._highlight.visible = true;
      this._highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this._highlight.visible = false;
    }
  }

  _update_chunk_visibility() {
    // With 8x8 chunks pre-generated, no streaming is needed. Chunks stay visible.
    // Here we could cull distant chunks — for now, no-op.
  }

  // ---- Game actions ----

  break_block() {
    if (this.state !== 'playing') return;
    if (this.mode === 'survival' && !this.controls.pointer_locked) return;

    const eye = this.player.eye_position();
    const dir = this.player.look_direction();
    const hit = raycast_voxel(this.world, eye, dir, RAY_MAX);

    if (!hit) return;
    if (hit.block === BLOCK.BEDROCK) return;

    // Remove and re-add (collect in survival)
    const removed = this.world.get_block(hit.x, hit.y, hit.z);
    this.world.set_block(hit.x, hit.y, hit.z, BLOCK.AIR);
    this.sound.break_block();
    this.camera_ctl.shake(0.02);

    if (this.mode === 'survival') {
      this.inventory.add_block(removed, 1);
    }
  }

  place_block() {
    if (this.state !== 'playing') return;
    if (this.mode === 'survival' && !this.controls.pointer_locked) return;

    const eye = this.player.eye_position();
    const dir = this.player.look_direction();
    const hit = raycast_voxel(this.world, eye, dir, RAY_MAX);

    if (!hit || !hit.face) return;

    const block_id = this.inventory.current_block();
    if (block_id === 0) return;

    if (this.mode === 'survival' && !this.inventory.has_block(block_id)) {
      this.sound.place_error();
      return;
    }

    // Target position = hit block + face normal
    const tx = hit.x + hit.face[0];
    const ty = hit.y + hit.face[1];
    const tz = hit.z + hit.face[2];

    // Don't place inside player
    const overlap = this._block_overlaps_player(tx, ty, tz);
    if (overlap) return;

    // Don't place inside existing solid block
    const existing = this.world.get_block(tx, ty, tz);
    if (existing !== 0 && BLOCK_DATA[existing].solid) return;

    this.world.set_block(tx, ty, tz, block_id);
    this.sound.place_block();
    this.camera_ctl.shake(0.015);

    if (this.mode === 'survival') {
      this.inventory.remove_block(block_id, 1);
    }
  }

  _block_overlaps_player(bx, by, bz) {
    const half = this.player.half;
    const height = this.player.height;
    const p = this.player.position;

    const pminx = p.x - half;
    const pmaxx = p.x + half;
    const pminy = p.y;
    const pmaxy = p.y + height;
    const pminz = p.z - half;
    const pmaxz = p.z + half;

    const bminx = bx, bmaxx = bx + 1;
    const bminy = by, bmaxy = by + 1;
    const bminz = bz, bmaxz = bz + 1;

    return (
      pminx < bmaxx && pmaxx > bminx &&
      pminy < bmaxy && pmaxy > bminy &&
      pminz < bmaxz && pmaxz > bminz
    );
  }

  // ---- Lifecycle ----

  async start_world({ id, name, seed, mode, player_data, changes }) {
    this.state = 'loading';
    this.current_world_id = id;
    this.current_world_name = name;
    this.mode = mode;

    // Wipe old world
    this.world.dispose();
    this.world = new World(this.scene);
    this.player = new Player(this.world);
    this.player.mode = mode;
    this.inventory.set_mode(mode);

    this.sound.init();
    if (this.ui) {
      this.ui.show_screen('loading-screen');
      this.ui.set_loading(0.02, 'Generating terrain…');
    }

    // Generate
    const chunks_per_side = Math.max(4, Math.min(10, this.settings.get('renderDistance') * 2));
    await this.world.generate(seed, chunks_per_side, (p) => {
      this.ui?.set_loading(p, p < 0.5 ? 'Generating terrain…' : 'Building meshes…');
    });

    if (changes && changes.size > 0) {
      this.ui?.set_loading(0.98, 'Applying saved changes…');
      this.world.apply_saved_changes(changes);
      await new Promise((r) => setTimeout(r, 50));
    }

    // Position player
    if (player_data) {
      this.player.set_position(player_data.x, player_data.y, player_data.z);
      this.player.yaw = player_data.yaw || 0;
      this.player.pitch = player_data.pitch || 0;
    } else {
      this.player.set_position(0, 0, 0);
      this.player.spawn_on_surface();
    }

    // Make sure spawn position isn't inside a block
    let safety = 0;
    while (this.player.is_inside_block() && safety < 200) {
      this.player.position.y += 1;
      safety++;
    }

    // Creative mode flies
    this.player.flying = (mode === 'creative');

    // Apply settings
    this.apply_settings();

    // Build UI
    this.ui?.build_hotbar();
    this.ui?.show_hud(true);
    this.ui?.show_screen(null);

    // Enter game
    this.state = 'playing';
    this.controls.enabled = true;

    if (this.controls.is_touch_device()) {
      // Show mobile controls
      document.getElementById('mobile-controls')?.classList.remove('hidden');
    } else {
      this.controls.request_pointer_lock();
    }

    this.sound.click();
  }

  apply_settings() {
    const s = this.settings;
    this.camera_ctl.set_fov(s.get('fov'));
    this.lighting.set_shadows_enabled(s.get('shadows'));
    this.lighting.set_render_distance(s.get('renderDistance'));
    this.sound.set_volume(s.get('volume'));
  }

  pause_game() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.controls.enabled = false;
    this.controls.exit_pointer_lock();
    this.ui?.show_screen('pause-menu');
  }

  resume_game() {
    if (this.state !== 'paused') return;
    this.ui?.show_screen(null);
    this.state = 'playing';
    this.controls.enabled = true;
    if (!this.controls.is_touch_device()) {
      this.controls.request_pointer_lock();
    }
  }

  toggle_inventory() {
    if (this.state === 'playing') {
      this.state = 'inventory';
      this.controls.exit_pointer_lock();
      this.controls.enabled = false;
      this.ui?.build_inventory_grid();
      this.ui?.show_screen('inventory-screen');
    } else if (this.state === 'inventory') {
      this.close_inventory();
    }
  }

  close_inventory() {
    if (this.state !== 'inventory') return;
    this.ui?.show_screen(null);
    this.state = 'playing';
    this.controls.enabled = true;
    if (!this.controls.is_touch_device()) {
      this.controls.request_pointer_lock();
    }
  }

  save_world() {
    if (!this.current_world_id) return;
    this.save_system.save(this.current_world_id, {
      name: this.current_world_name,
      seed: this.world.seed,
      mode: this.mode,
      player: this.player,
      changes: this.world.changes,
    });
    this.sound.click();
    // Brief confirmation via game info
    if (this.ui) {
      const el = document.getElementById('game-info');
      if (el) {
        const orig = el.innerHTML;
        el.innerHTML = '<div class="info-line" style="color:#4ade80">World saved</div>';
        setTimeout(() => { if (el) el.innerHTML = orig; }, 1200);
      }
    }
  }

  quit_to_menu() {
    this.state = 'menu';
    this.controls.enabled = false;
    this.controls.exit_pointer_lock();
    this.world.dispose();
    this.world = new World(this.scene);
    this.player = new Player(this.world);
    this._highlight.visible = false;
    this.ui?.show_hud(false);
    this.ui?.show_screen('main-menu');
    document.getElementById('mobile-controls')?.classList.add('hidden');
  }

  is_playing() {
    return this.state === 'playing' || this.state === 'paused' || this.state === 'inventory';
  }

  _on_resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera_ctl.resize(w, h);
  }
}
