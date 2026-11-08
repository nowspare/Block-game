// Bootstrap — loads textures, constructs the game, wires the UI, shows the menu.

import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { create_atlas_texture } from './textures.js';

function set_status(p, text, color = null) {
  const fill = document.getElementById('loading-fill');
  const label = document.getElementById('loading-text');
  if (fill) fill.style.width = `${Math.round(p * 100)}%`;
  if (label) {
    if (text) label.textContent = text;
    if (color) label.style.color = color;
    else label.style.color = '';
  }
}

function fail(msg) {
  console.error('[BlockForge boot]', msg);
  set_status(1, 'Boot failure: ' + msg, '#ef4444');
  const label = document.getElementById('loading-text');
  if (label) {
    label.style.fontSize = '0.78rem';
    label.style.maxWidth = '80vw';
    label.style.wordBreak = 'break-word';
    label.style.whiteSpace = 'pre-wrap';
  }
}

async function boot() {
  // Sanity-check: three.js actually resolved
  if (!THREE || !THREE.WebGLRenderer) {
    fail('three.js failed to load from CDN. Check network / adblock.');
    return;
  }

  set_status(0.1, 'Painting voxel textures…');
  await new Promise((r) => setTimeout(r, 30));

  try {
    create_atlas_texture();
  } catch (e) {
    fail('texture atlas: ' + e.message);
    return;
  }

  set_status(0.4, 'Starting renderer…');
  await new Promise((r) => setTimeout(r, 30));

  let game, ui;
  try {
    game = new Game();
    ui = new UI(game);
    game.set_ui(ui);
  } catch (e) {
    fail('engine init: ' + e.message);
    console.error(e);
    return;
  }

  window.BlockForge = { game, ui };

  set_status(0.85, 'Wiring UI…');
  await new Promise((r) => setTimeout(r, 40));

  set_status(1.0, 'Ready.');
  await new Promise((r) => setTimeout(r, 180));

  ui.show_screen('main-menu');

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (game.state === 'playing') game.pause_game();
      else if (game.state === 'paused') game.resume_game();
      else if (game.state === 'inventory') game.close_inventory();
    }
  });
}

// Give the loading screen one paint frame before starting
requestAnimationFrame(() => {
  boot().catch((err) => {
    fail((err && err.message) ? err.message : String(err));
    console.error(err);
  });
});