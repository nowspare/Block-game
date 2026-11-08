// Procedural texture atlas generation.
// Every block face is painted at runtime into one 4x4 grid (16 tiles).
// No external image files needed — all pixels are code.

import * as THREE from 'three';

export const TILE_SIZE = 32;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;
export const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS;

export const TILE_INDEX = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  wood_side: 6,
  wood_top: 7,
  leaves: 8,
  bedrock: 9,
  planks: 10,
  cobble: 11,
  glass: 12,
  brick: 13,
  snow: 14,
  reserve: 15,
};

// Deterministic per-pixel pseudo-random hash (no noise library needed)
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1000) / 1000;
}

// ---- Tile painters ---------------------------------------------------
// Each receives a 2D context already clipped to a 32x32 tile at (0,0).

function paint_grass_top(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 1);
      const r = (68 + n * 38) | 0;
      const g = (128 + n * 55) | 0;
      const b = (48 + n * 28) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_grass_side(ctx) {
  const strip = TILE_SIZE * 0.28;
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 2);
      let r, g, b;
      if (y < strip) {
        r = (68 + n * 30) | 0;
        g = (126 + n * 48) | 0;
        b = (46 + n * 20) | 0;
      } else {
        r = (100 + n * 38) | 0;
        g = (68 + n * 28) | 0;
        b = (48 + n * 22) | 0;
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_dirt(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 3);
      const r = (98 + n * 36) | 0;
      const g = (66 + n * 26) | 0;
      const b = (46 + n * 20) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_stone(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 4);
      const v = (110 + n * 40) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_sand(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 5);
      const r = (208 + n * 30) | 0;
      const g = (192 + n * 26) | 0;
      const b = (140 + n * 22) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_water(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 6);
      const r = (50 + n * 20) | 0;
      const g = (110 + n * 30) | 0;
      const b = (200 + n * 30) | 0;
      const a = 0.62 + n * 0.06;
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // subtle horizontal ripple
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 4; y < TILE_SIZE; y += 8) {
    ctx.fillRect(0, y, TILE_SIZE, 1);
  }
}

function paint_wood_side(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, Math.floor(y / 4), 7);
      const r = (100 + n * 30) | 0;
      const g = (68 + n * 22) | 0;
      const b = (44 + n * 16) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 2; x < TILE_SIZE; x += 8) {
    ctx.fillRect(x, 0, 1, TILE_SIZE);
  }
}

function paint_wood_top(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const dx = x - TILE_SIZE / 2;
      const dy = y - TILE_SIZE / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ring = (Math.sin(d * 1.1) + 1) / 2;
      const n = hash(x, y, 8);
      const base = 130 + n * 22;
      const r = (base + ring * 30) | 0;
      const g = (90 + ring * 22) | 0;
      const b = (54 + ring * 14) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_leaves(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 9);
      if (n < 0.18) {
        // transparent hole
        ctx.clearRect(x, y, 1, 1);
        continue;
      }
      const r = (44 + n * 40) | 0;
      const g = (98 + n * 60) | 0;
      const b = (38 + n * 30) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_bedrock(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 10);
      const v = (22 + n * 55) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paint_planks(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, Math.floor(y / 4), 11);
      const r = (168 + n * 26) | 0;
      const g = (122 + n * 22) | 0;
      const b = (72 + n * 18) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let y = 8; y < TILE_SIZE; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TILE_SIZE, y + 0.5);
    ctx.stroke();
  }
}

function paint_cobble(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const bx = Math.floor(x / 8);
      const by = Math.floor(y / 8);
      const n = hash(bx, by, 12);
      const jitter = hash(x, y, 12);
      const v = (88 + n * 50 + jitter * 20) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= TILE_SIZE; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TILE_SIZE, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x <= TILE_SIZE; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, TILE_SIZE);
    ctx.stroke();
  }
}

function paint_glass(ctx) {
  // transparent center, opaque light-blue frame + highlight
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const edge = x < 3 || y < 3 || x >= TILE_SIZE - 3 || y >= TILE_SIZE - 3;
      if (edge) {
        ctx.fillStyle = 'rgba(185,220,240,0.85)';
      } else {
        ctx.fillStyle = 'rgba(200,230,255,0.12)';
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // highlight streak
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, 24);
  ctx.lineTo(24, 6);
  ctx.stroke();
}

function paint_brick(ctx) {
  ctx.fillStyle = 'rgb(140,70,52)';
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = 'rgb(88,86,82)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= TILE_SIZE; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TILE_SIZE, y + 0.5);
    ctx.stroke();
    const offset = ((y / 8) % 2) * 8;
    for (let x = offset; x <= TILE_SIZE; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + 8);
      ctx.stroke();
    }
  }
  // slight per-pixel variation
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 13);
      if (n > 0.65) {
        ctx.fillStyle = `rgba(255,120,90,${n * 0.15})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function paint_snow(ctx) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y, 14);
      const v = (232 + n * 22) | 0;
      const blue = (10 + n * 12) | 0;
      ctx.fillStyle = `rgb(${v - blue},${v - blue / 2},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const PAINTERS = {
  0: paint_grass_top,
  1: paint_grass_side,
  2: paint_dirt,
  3: paint_stone,
  4: paint_sand,
  5: paint_water,
  6: paint_wood_side,
  7: paint_wood_top,
  8: paint_leaves,
  9: paint_bedrock,
  10: paint_planks,
  11: paint_cobble,
  12: paint_glass,
  13: paint_brick,
  14: paint_snow,
  15: () => {},
};

// ---- Atlas builder ---------------------------------------------------

let atlas_texture = null;
const tile_canvases = {};

export function create_atlas_texture() {
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_SIZE;
  atlas.height = ATLAS_SIZE;
  const ctx = atlas.getContext('2d');

  for (let idx = 0; idx < ATLAS_COLS * ATLAS_ROWS; idx++) {
    const tile = document.createElement('canvas');
    tile.width = TILE_SIZE;
    tile.height = TILE_SIZE;
    const tctx = tile.getContext('2d');
    const painter = PAINTERS[idx];
    if (painter) painter(tctx);

    tile_canvases[idx] = tile;

    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    ctx.drawImage(tile, col * TILE_SIZE, row * TILE_SIZE);
  }

  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  atlas_texture = tex;
  return tex;
}

export function get_atlas_texture() {
  return atlas_texture;
}

// UV rect for a given tile name (0..1 atlas coords, v flipped for Three.js)
export function tile_uv(name) {
  const idx = TILE_INDEX[name];
  if (idx === undefined) {
    return { u0: 0, v0: 0, u1: 1, v1: 1 };
  }
  const col = idx % ATLAS_COLS;
  const row = Math.floor(idx / ATLAS_COLS);
  return {
    u0: col / ATLAS_COLS,
    u1: (col + 1) / ATLAS_COLS,
    v0: 1 - (row + 1) / ATLAS_ROWS,
    v1: 1 - row / ATLAS_ROWS,
  };
}

// Data URL of a single tile — used for hotbar / inventory icons.
export function tile_data_url(name) {
  const idx = TILE_INDEX[name];
  const c = tile_canvases[idx];
  return c ? c.toDataURL() : '';
}
