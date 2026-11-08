// Chunked voxel world: terrain generation, meshing, block queries.

import * as THREE from 'three';
import { BLOCK, BLOCK_DATA } from './blocks.js';
import { create_atlas_texture, get_atlas_texture, tile_uv } from './textures.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 26;

// ---------- Noise helpers (deterministic) ----------

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function value_noise2(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = smooth(fx);
  const v = smooth(fy);

  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm2(x, y, seed, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += value_noise2(x * freq, y * freq, seed + i * 37) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

function value_noise3(x, y, z, seed) {
  // cheap 3D value noise via 2 stacked 2D samples along z
  const z0 = Math.floor(z);
  const fz = smooth(z - z0);
  const a = value_noise2(x + z0 * 17, y + z0 * 13, seed);
  const b = value_noise2(x + (z0 + 1) * 17, y + (z0 + 1) * 13, seed);
  return a * (1 - fz) + b * fz;
}

// ---------- Chunk ----------

class Chunk {
  constructor(world, cx, cz) {
    this.world = world;
    this.cx = cx; // chunk coordinate
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.mesh_opaque = null;
    this.mesh_transparent = null;
    this.dirty = true;
  }

  index(lx, ly, lz) {
    return (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  get_local(lx, ly, lz) {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return 0;
    return this.data[this.index(lx, ly, lz)];
  }

  set_local(lx, ly, lz, block) {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return;
    this.data[this.index(lx, ly, lz)] = block;
  }

  // ---------- Generation ----------

  generate(seed) {
    const baseX = this.cx * CHUNK_SIZE;
    const baseZ = this.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;

        // Height map — two fbm layers for hills + mountains
        const base = fbm2(wx * 0.012, wz * 0.012, seed, 4);
        const detail = fbm2(wx * 0.05, wz * 0.05, seed + 991, 3);
        const mountain = Math.pow(fbm2(wx * 0.004, wz * 0.004, seed + 442, 3), 1.6);

        let height = Math.floor(
          14 + base * 22 + detail * 6 + mountain * 20
        );
        height = Math.max(2, Math.min(WORLD_HEIGHT - 8, height));

        // Biome / surface block
        let surface_block = BLOCK.GRASS;
        let sub_block = BLOCK.DIRT;

        const temp = fbm2(wx * 0.008, wz * 0.008, seed + 313, 3);
        if (height <= SEA_LEVEL + 1) {
          surface_block = BLOCK.SAND;
          sub_block = BLOCK.SAND;
        } else if (height > 46) {
          surface_block = BLOCK.SNOW;
          sub_block = BLOCK.STONE;
        } else if (temp < 0.35) {
          surface_block = BLOCK.SAND;
          sub_block = BLOCK.SAND;
        }

        for (let y = 0; y < height; y++) {
          let block;
          if (y === 0) block = BLOCK.BEDROCK;
          else if (y < height - 4) block = BLOCK.STONE;
          else if (y < height - 1) block = sub_block;
          else block = surface_block;

          // Cave carving (below surface-2)
          if (y > 2 && y < height - 2) {
            const c = value_noise3(wx * 0.08, y * 0.08, wz * 0.08, seed + 7777);
            if (c > 0.62) block = BLOCK.AIR;
          }

          this.set_local(lx, y, lz, block);
        }

        // Water fill
        for (let y = height; y <= SEA_LEVEL; y++) {
          if (this.get_local(lx, y, lz) === BLOCK.AIR) {
            this.set_local(lx, y, lz, BLOCK.WATER);
          }
        }

        // Trees (surface grass only)
        if (surface_block === BLOCK.GRASS && height > SEA_LEVEL + 1) {
          const tree_rng = hash2(wx, wz, seed + 2024);
          if (tree_rng > 0.985 && lx >= 2 && lx <= CHUNK_SIZE - 3 && lz >= 2 && lz <= CHUNK_SIZE - 3) {
            this._place_tree(lx, height, lz);
          }
        }
      }
    }
  }

  _place_tree(lx, base_y, lz) {
    const trunk_height = 4 + Math.floor(hash2(lx, lz, 42) * 2);
    for (let y = 1; y <= trunk_height; y++) {
      this.set_local(lx, base_y + y, lz, BLOCK.WOOD);
    }
    const top = base_y + trunk_height;
    // leaves — cross shape
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < 0) continue;
          const px = lx + dx;
          const py = top + dy;
          const pz = lz + dz;
          if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE && py >= 0 && py < WORLD_HEIGHT) {
            if (this.get_local(px, py, pz) === BLOCK.AIR) {
              this.set_local(px, py, pz, BLOCK.LEAVES);
            }
          }
        }
      }
    }
  }

  // ---------- Meshing ----------

  build_mesh(world) {
    const opaque = { positions: [], normals: [], uvs: [], indices: [] };
    const transparent = { positions: [], normals: [], uvs: [], indices: [] };

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const block = this.get_local(lx, ly, lz);
          if (block === 0) continue;

          const data = BLOCK_DATA[block];
          const target = data.transparent ? transparent : opaque;

          for (const face of FACES) {
            const nx = lx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = lz + face.dir[2];

            // Neighbor block (world coords)
            const wx = this.cx * CHUNK_SIZE + nx;
            const wz = this.cz * CHUNK_SIZE + nz;
            const neighbor = (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT)
              ? this.get_local(nx, ny, nz)
              : world.get_block(wx, ny, wz);

            if (!should_render_face(block, neighbor)) continue;

            add_face(target, lx, ly, lz, face, data.tiles);
          }
        }
      }
    }

    this._apply_geometry(opaque, 'opaque');
    this._apply_geometry(transparent, 'transparent');
    this.dirty = false;
  }

  _apply_geometry(buf, kind) {
    const mesh_key = kind === 'opaque' ? 'mesh_opaque' : 'mesh_transparent';
    const existing = this[mesh_key];

    if (buf.positions.length === 0) {
      if (existing) {
        existing.parent && existing.parent.remove(existing);
        existing.geometry.dispose();
        this[mesh_key] = null;
      }
      return;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
    geo.setIndex(buf.indices);

    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
    } else {
      const mat = kind === 'opaque'
        ? this.world.material_opaque
        : this.world.material_transparent;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
      mesh.castShadow = kind === 'opaque';
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      if (kind === 'transparent') mesh.renderOrder = 1;

      this.world.scene.add(mesh);
      this[mesh_key] = mesh;
    }

    // Update position (in case chunk moved — shouldn't happen, but safe)
    if (this[mesh_key]) {
      this[mesh_key].position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
    }
  }

  dispose_meshes() {
    for (const key of ['mesh_opaque', 'mesh_transparent']) {
      const m = this[key];
      if (m) {
        this.world.scene.remove(m);
        m.geometry.dispose();
        this[key] = null;
      }
    }
  }
}

// ---------- Face table ----------

const FACES = [
  { dir: [1, 0, 0],  corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], tex: 'side' },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], tex: 'side' },
  { dir: [0, 1, 0],  corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tex: 'top' },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [0, 0, 0], [1, 0, 0]], tex: 'bottom' },
  { dir: [0, 0, 1],  corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tex: 'side' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tex: 'side' },
];

function should_render_face(current, neighbor) {
  if (neighbor === 0) return true;
  const n = BLOCK_DATA[neighbor];
  if (!n.transparent) return false;
  return neighbor !== current;
}

function add_face(target, x, y, z, face, tiles) {
  const idx = target.positions.length / 3;
  const tile_name = face.tex === 'top' ? tiles.top : face.tex === 'bottom' ? tiles.bottom : tiles.side;
  const { u0, v0, u1, v1 } = tile_uv(tile_name);

  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    target.positions.push(x + c[0], y + c[1], z + c[2]);
    target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
  }

  target.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  target.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
}

// ---------- World ----------

export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map(); // key: "cx,cz"
    this.seed = 0;
    this.changes = new Map(); // "x,y,z" -> blockId (persisted diffs)

    const atlas = create_atlas_texture();
    this.material_opaque = new THREE.MeshLambertMaterial({
      map: atlas,
      side: THREE.FrontSide,
    });
    this.material_transparent = new THREE.MeshLambertMaterial({
      map: atlas,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
    });
  }

  // ---- Query ----

  get_block(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 0;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.get_local(lx, y, lz);
  }

  set_block(x, y, z, block) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return false;

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const prev = chunk.get_local(lx, y, lz);
    if (prev === block) return false;

    chunk.set_local(lx, y, lz, block);
    this.changes.set(`${x},${y},${z}`, block);

    // Rebuild the chunk, plus neighbours if on edge
    chunk.build_mesh(this);
    if (lx === 0) this._rebuild_chunk(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this._rebuild_chunk(cx + 1, cz);
    if (lz === 0) this._rebuild_chunk(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this._rebuild_chunk(cx, cz + 1);

    return true;
  }

  _rebuild_chunk(cx, cz) {
    const c = this.chunks.get(`${cx},${cz}`);
    if (c) c.build_mesh(this);
  }

  // ---- Generation ----

  async generate(seed, chunks_per_side, progress_cb) {
    this.seed = seed;
    this.changes.clear();
    this.dispose();

    const half = Math.floor(chunks_per_side / 2);
    const total = chunks_per_side * chunks_per_side;
    let done = 0;

    // Phase 1: create chunks and generate data
    for (let cx = -half; cx < chunks_per_side - half; cx++) {
      for (let cz = -half; cz < chunks_per_side - half; cz++) {
        const chunk = new Chunk(this, cx, cz);
        chunk.generate(seed);
        this.chunks.set(`${cx},${cz}`, chunk);
        done++;
        if (done % 3 === 0) {
          if (progress_cb) progress_cb((done / total) * 0.5);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    // Phase 2: mesh all chunks
    done = 0;
    for (const chunk of this.chunks.values()) {
      chunk.build_mesh(this);
      done++;
      if (done % 3 === 0) {
        if (progress_cb) progress_cb(0.5 + (done / total) * 0.5);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (progress_cb) progress_cb(1);
  }

  apply_saved_changes(changes) {
    if (!changes) return;
    for (const [key, block] of changes) {
      const parts = key.split(',').map(Number);
      const [x, y, z] = parts;
      // Directly set without going through set_block's change tracking duplication
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const chunk = this.chunks.get(`${cx},${cz}`);
      if (!chunk) continue;
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk.set_local(lx, y, lz, block);
      this.changes.set(key, block);
    }
    // Rebuild affected chunks once
    for (const chunk of this.chunks.values()) {
      chunk.build_mesh(this);
    }
  }

  get_highest_block(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const b = this.get_block(x, y, z);
      if (b !== 0 && BLOCK_DATA[b].solid) return y;
    }
    return 0;
  }

  get_chunk_at(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return this.chunks.get(`${cx},${cz}`) || null;
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.dispose_meshes();
    }
    this.chunks.clear();
  }
}
