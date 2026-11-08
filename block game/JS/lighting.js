// Day/night cycle: sun, moon, ambient, sky color, fog.

import * as THREE from 'three';

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.time_of_day = 12; // hours 0–24
    this.day_length = 600; // real seconds per full day
    this.paused = false;

    // Sun (also acts as moon at night)
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 250;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Ambient
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(this.ambient);

    // Sky / fog
    this.sky_day = new THREE.Color(0x87ceeb);
    this.sky_sunset = new THREE.Color(0xff7733);
    this.sky_night = new THREE.Color(0x050a1a);

    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

    this._current_sky = new THREE.Color(0x87ceeb);
    this.update(0);
  }

  set_shadows_enabled(enabled) {
    this.sun.castShadow = enabled;
  }

  set_render_distance(chunks) {
    // chunks = number of chunks; each chunk is 16 blocks
    const far = chunks * 16;
    this.scene.fog.near = far * 0.55;
    this.scene.fog.far = far * 0.95;
  }

  update(dt) {
    if (!this.paused && dt > 0) {
      this.time_of_day = (this.time_of_day + (dt / this.day_length) * 24) % 24;
    }

    // sun_angle: 0 at sunrise (hour 6), PI/2 at noon, PI at sunset, -PI/2 at midnight
    const angle = ((this.time_of_day - 6) / 12) * Math.PI;
    const sun_height = Math.sin(angle);
    const sun_x = Math.cos(angle) * 120;
    const sun_y = sun_height * 120;

    const is_day = sun_height > -0.05;
    const light_dir = is_day
      ? [sun_x, Math.max(sun_y, 5), 40]
      : [-sun_x, Math.max(-sun_y, 5), 40];

    this.sun.position.set(...light_dir);
    this.sun.target.position.set(0, 0, 0);

    // Colors and intensities
    let sun_color_hex, sun_intensity, ambient_intensity, ambient_color_hex;
    if (sun_height > 0.1) {
      const t = Math.min(1, (sun_height - 0.1) / 0.6);
      sun_color_hex = 0xfff4e0;
      sun_intensity = 0.5 + t * 0.5;
      ambient_intensity = 0.35 + t * 0.15;
      ambient_color_hex = 0xffffff;
    } else if (sun_height > -0.1) {
      sun_color_hex = 0xff9955;
      sun_intensity = 0.35;
      ambient_intensity = 0.3;
      ambient_color_hex = 0xffbbaa;
    } else {
      sun_color_hex = 0x8899cc;
      sun_intensity = 0.12;
      ambient_intensity = 0.22;
      ambient_color_hex = 0x8899bb;
    }

    this.sun.color.setHex(sun_color_hex);
    this.sun.intensity = sun_intensity;
    this.ambient.color.setHex(ambient_color_hex);
    this.ambient.intensity = ambient_intensity;

    // Sky color blending
    let sky;
    if (sun_height > 0.1) {
      sky = this.sky_day.clone();
    } else if (sun_height > -0.1) {
      const t = (sun_height + 0.1) / 0.2; // 0 at night edge, 1 at day edge
      sky = this.sky_sunset.clone().lerp(this.sky_day, t);
    } else {
      sky = this.sky_night.clone();
    }

    // Smooth transitions
    this._current_sky.lerp(sky, Math.min(1, dt * 2.5 + 0.05));
    this.scene.background.copy(this._current_sky);
    this.scene.fog.color.copy(this._current_sky);
  }

  set_time(hours) {
    this.time_of_day = ((hours % 24) + 24) % 24;
  }
}
