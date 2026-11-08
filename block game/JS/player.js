// Player entity — position, movement, physics, camera-orientation state.

import * as THREE from 'three';
import { BLOCK_DATA } from './blocks.js';
import { collides } from './physics.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.position = new THREE.Vector3(0, 50, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.width = 0.6;
    this.height = 1.8;
    this.eye_height = 1.62;
    this.half = this.width / 2;

    this.on_ground = false;
    this.flying = false;
    this.mode = 'creative'; // 'creative' | 'survival' | 'free'

    this.walk_speed = 5.2;
    this.sprint_speed = 8.5;
    this.fly_speed = 12.0;
    this.jump_speed = 8.5;
    this.gravity = 24.0;

    this._was_on_ground = false;
  }

  eye_position() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + (this.flying ? this.eye_height : this.eye_height),
      this.position.z
    );
  }

  look_direction() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp
    );
  }

  set_position(x, y, z) {
    this.position.set(x, y, z);
  }

  spawn_on_surface() {
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    const top = this.world.get_highest_block(x, z);
    this.position.set(x + 0.5, top + 1.1, z + 0.5);
    this.velocity.set(0, 0, 0);
  }

  update(dt, input) {
    if (dt > 0.1) dt = 0.1; // cap frame delta

    // --- Movement intention ---
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wish = new THREE.Vector3();
    if (input.forward) wish.add(forward);
    if (input.backward) wish.sub(forward);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const sprinting = input.sprint && !input.crouch;

    if (this.flying) {
      const speed = this.fly_speed * (sprinting ? 1.6 : 1.0);
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      let vy = 0;
      if (input.jump) vy += speed;
      if (input.crouch) vy -= speed;
      this.velocity.y = vy;
    } else {
      const speed = sprinting ? this.sprint_speed : this.walk_speed;
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;

      // Gravity + jump
      this.velocity.y -= this.gravity * dt;

      if (input.jump && this.on_ground) {
        this.velocity.y = this.jump_speed;
        this.on_ground = false;
      }
    }

    // --- Move + collide (substeps for safety) ---
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;
    const max_delta = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const steps = Math.max(1, Math.ceil(max_delta / 0.25));

    for (let i = 0; i < steps; i++) {
      this._try_axis(dx / steps, 0, 0);
      this._try_axis(0, dy / steps, 0);
      this._try_axis(0, 0, dz / steps);
    }

    // Landing / falling track
    if (this.on_ground && !this._was_on_ground) {
      input.on_land?.();
    }
    this._was_on_ground = this.on_ground;

    // Reset on_ground flag (will be re-set by downward-collision resolution)
    this.on_ground = false;

    // Check ground contact — sample a point slightly below feet
    const below = this.position.clone();
    below.y -= 0.05;
    if (collides(this.world, below, this.half, 0.05)) {
      this.on_ground = true;
    }
  }

  _try_axis(dx, dy, dz) {
    if (dx === 0 && dy === 0 && dz === 0) return;

    const new_pos = this.position.clone();
    new_pos.x += dx;
    new_pos.y += dy;
    new_pos.z += dz;

    if (!collides(this.world, new_pos, this.half, this.height)) {
      this.position.copy(new_pos);
      return;
    }

    // Snap to boundary
    const eps = 0.001;

    if (dx !== 0) {
      if (dx > 0) {
        const wall = Math.floor(new_pos.x + this.half);
        this.position.x = wall - this.half - eps;
      } else {
        const wall = Math.ceil(new_pos.x - this.half);
        this.position.x = wall + this.half + eps;
      }
      this.velocity.x = 0;
    }

    if (dy !== 0) {
      if (dy > 0) {
        const wall = Math.floor(new_pos.y + this.height);
        this.position.y = wall - this.height - eps;
        this.velocity.y = 0;
      } else {
        const wall = Math.ceil(new_pos.y);
        this.position.y = wall + eps;
        this.velocity.y = 0;
        this.on_ground = true;
      }
    }

    if (dz !== 0) {
      if (dz > 0) {
        const wall = Math.floor(new_pos.z + this.half);
        this.position.z = wall - this.half - eps;
      } else {
        const wall = Math.ceil(new_pos.z - this.half);
        this.position.z = wall + this.half + eps;
      }
      this.velocity.z = 0;
    }
  }

  is_inside_block() {
    return collides(this.world, this.position, this.half, this.height);
  }
}
