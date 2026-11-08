// Low-level physics helpers: voxel raycast + AABB collision.

import { BLOCK_DATA } from './blocks.js';

// Amanatides & Woo voxel traversal.
// Returns { x, y, z, face, block } of the first solid hit, or null.
export function raycast_voxel(world, origin, direction, max_dist = 8) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const dx = direction.x;
  const dy = direction.y;
  const dz = direction.z;

  if (dx === 0 && dy === 0 && dz === 0) return null;

  const step_x = Math.sign(dx);
  const step_y = Math.sign(dy);
  const step_z = Math.sign(dz);

  const t_delta_x = dx === 0 ? Infinity : Math.abs(1 / dx);
  const t_delta_y = dy === 0 ? Infinity : Math.abs(1 / dy);
  const t_delta_z = dz === 0 ? Infinity : Math.abs(1 / dz);

  let t_max_x = dx === 0
    ? Infinity
    : (step_x > 0 ? (x + 1 - origin.x) : (origin.x - x)) / Math.abs(dx);
  let t_max_y = dy === 0
    ? Infinity
    : (step_y > 0 ? (y + 1 - origin.y) : (origin.y - y)) / Math.abs(dy);
  let t_max_z = dz === 0
    ? Infinity
    : (step_z > 0 ? (z + 1 - origin.z) : (origin.z - z)) / Math.abs(dz);

  let t = 0;
  let face = null;

  for (let i = 0; i < 256; i++) {
    const block = world.get_block(x, y, z);
    if (block !== 0 && BLOCK_DATA[block].solid) {
      return { x, y, z, face, block };
    }

    if (t_max_x < t_max_y && t_max_x < t_max_z) {
      x += step_x;
      t = t_max_x;
      t_max_x += t_delta_x;
      face = [-step_x, 0, 0];
    } else if (t_max_y < t_max_z) {
      y += step_y;
      t = t_max_y;
      t_max_y += t_delta_y;
      face = [0, -step_y, 0];
    } else {
      z += step_z;
      t = t_max_z;
      t_max_z += t_delta_z;
      face = [0, 0, -step_z];
    }

    if (t > max_dist) return null;
  }
  return null;
}

// AABB collision check against the voxel world.
// pos = feet position (center of AABB horizontally, bottom at pos.y)
export function collides(world, pos, half, height) {
  const eps = 0.001;
  const minX = Math.floor(pos.x - half + eps);
  const maxX = Math.floor(pos.x + half - eps);
  const minY = Math.floor(pos.y + eps);
  const maxY = Math.floor(pos.y + height - eps);
  const minZ = Math.floor(pos.z - half + eps);
  const maxZ = Math.floor(pos.z + half - eps);

  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        const b = world.get_block(bx, by, bz);
        if (b !== 0 && BLOCK_DATA[b].solid) return true;
      }
    }
  }
  return false;
}
