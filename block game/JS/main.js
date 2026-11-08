// Bootstrap — loads textures, constructs the game, wires the UI, shows the menu.

import { Game } from './game.js';
import { UI } from './ui.js';
import { create_atlas_texture } from './textures.js';

async function boot() {
  const loading_text = document.getElementById('loading-text');
  const loading_fill = document.getElementById('loading-fill');

  const set_progress = (p, text) => {
    if (loading_fill) loading_fill.style.width = `${Math.round(p * 100)}%`;
    if (loading_text && text) loading_text.textContent = text;
  };

  set_progress(0.1, 'Painting voxel textures…');

  // Give the browser a frame to render the loading screen
  await new Promise((r) => setTimeout(r, 30));

  // Generate the texture atlas (needs no DOM beyond canvas)
  create_atlas_texture();

  set_progress(0.4, 'Starting renderer…');
  await new Promise((r) => setTimeout(r, 30));

  // Construct game + UI
  const game = new Game();
  const ui = new UI(game);
  game.set_ui(ui);

  // Expose for debugging / external hooks
  window.BlockForge = { game, ui };

  set_progress(0.85, 'Wiring UI…');
  await new Promise((r) => setTimeout(r, 40));

  // Show main menu
  set_progress(1.0, 'Ready.');
  await new Promise((r) => setTimeout(r, 180));

  ui.show_screen('main-menu');

  // Wire Esc key
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (game.state === 'playing') game.pause_game();
      else if (game.state === 'paused') game.resume_game();
      else if (game.state === 'inventory') game.close_inventory();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  if (t) {
    t.textContent = 'Failed to start: ' + (err?.message || 'unknown error');
    t.style.color = '#ef4444';
  }
});
