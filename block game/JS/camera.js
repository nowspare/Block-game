// Camera wrapper — first-person view, FOV, aspect handling.

import * as THREE from 'three';

export class CameraController {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.rotation.order = 'YXZ';
    this.target_fov = 75;
    this._current_fov = 75;
    this._shake = 0;
  }

  set_fov(fov) {
    this.target_fov = fov;
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  shake(amount = 0.05) {
    this._shake = amount;
  }

  // Update camera from player state.
  update(player, dt) {
    const eye = player.eye_position();
    this.camera.position.copy(eye);

    // Smooth FOV transition
    this._current_fov += (this.target_fov - this._current_fov) * Math.min(1, dt * 12);
    if (Math.abs(this.camera.fov - this._current_fov) > 0.01) {
      this.camera.fov = this._current_fov;
      this.camera.updateProjectionMatrix();
    }

    // Add a tiny bob when walking on the ground
    const horizontal_speed = Math.hypot(player.velocity.x, player.velocity.z);
    const bob_amount = player.on_ground && horizontal_speed > 0.5
      ? Math.sin(performance.now() * 0.012) * 0.035 * Math.min(1, horizontal_speed / 6)
      : 0;

    this.camera.rotation.y = player.yaw;
    this.camera.rotation.x = player.pitch;
    this.camera.position.y += bob_amount;

    // Shake decay
    if (this._shake > 0.0001) {
      const s = this._shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this._shake *= 0.85;
    }
  }
}
