// Input handling: keyboard, mouse (pointer-lock), and touch.

export class Controls {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.enabled = false;
    this.pointer_locked = false;

    this.state = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
    };

    this.mouse_dx = 0;
    this.mouse_dy = 0;
    this.wheel_delta = 0;

    this.on_break = null;
    this.on_place = null;
    this.on_hotbar = null;
    this.on_inventory = null;
    this.on_pointerlock_change = null;
    this.on_land = null;

    // touch state
    this.touch_look_id = null;
    this.touch_look_x = 0;
    this.touch_look_y = 0;
    this._mobile_joystick = { active: false, id: null, base_x: 0, base_y: 0 };
    this._is_touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    this._bind_events();
  }

  _bind_events() {
    // Keyboard
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));

    // Mouse
    document.addEventListener('mousemove', (e) => this._mouse_move(e));
    document.addEventListener('pointerlockchange', () => this._pointerlock_change());
    this.canvas.addEventListener('mousedown', (e) => this._mouse_down(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this._wheel(e), { passive: false });

    // Touch
    if (this._is_touch) {
      this.canvas.addEventListener('touchstart', (e) => this._touch_start(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this._touch_move(e), { passive: false });
      this.canvas.addEventListener('touchend', (e) => this._touch_end(e), { passive: false });
      this.canvas.addEventListener('touchcancel', (e) => this._touch_end(e), { passive: false });
    }
  }

  _key(e, down) {
    if (!this.enabled) return;

    const code = e.code;
    let handled = true;

    switch (code) {
      case 'KeyW': case 'ArrowUp':    this.state.forward = down; break;
      case 'KeyS': case 'ArrowDown':  this.state.backward = down; break;
      case 'KeyA': case 'ArrowLeft':  this.state.left = down; break;
      case 'KeyD': case 'ArrowRight': this.state.right = down; break;
      case 'Space':                   this.state.jump = down; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.sprint = down; break;
      case 'ControlLeft': case 'ControlRight': this.state.crouch = down; break;
      case 'Digit1': if (down) this.on_hotbar?.(0); break;
      case 'Digit2': if (down) this.on_hotbar?.(1); break;
      case 'Digit3': if (down) this.on_hotbar?.(2); break;
      case 'Digit4': if (down) this.on_hotbar?.(3); break;
      case 'Digit5': if (down) this.on_hotbar?.(4); break;
      case 'Digit6': if (down) this.on_hotbar?.(5); break;
      case 'Digit7': if (down) this.on_hotbar?.(6); break;
      case 'Digit8': if (down) this.on_hotbar?.(7); break;
      case 'Digit9': if (down) this.on_hotbar?.(8); break;
      case 'KeyE': if (down) this.on_inventory?.(); break;
      default: handled = false;
    }

    if (handled && (code === 'Space' || code.startsWith('Arrow') || code === 'KeyE')) {
      e.preventDefault();
    }
  }

  _mouse_move(e) {
    if (!this.pointer_locked || !this.enabled) return;
    this.mouse_dx += e.movementX;
    this.mouse_dy += e.movementY;
  }

  _mouse_down(e) {
    if (!this.enabled) return;

    if (!this.pointer_locked) {
      this.request_pointer_lock();
      return;
    }

    if (e.button === 0) this.on_break?.();
    else if (e.button === 2) this.on_place?.();
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.wheel_delta += Math.sign(e.deltaY);
  }

  _pointerlock_change() {
    this.pointer_locked = document.pointerLockElement === this.canvas;
    this.on_pointerlock_change?.(this.pointer_locked);
  }

  request_pointer_lock() {
    if (this._is_touch) return;
    this.canvas.requestPointerLock?.();
  }

  exit_pointer_lock() {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  // ---- Touch controls ----

  _touch_start(e) {
    if (!this.enabled) return;

    for (const touch of e.changedTouches) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && el.closest && el.closest('#mobile-controls')) {
        // handled by the mobile overlay buttons
        continue;
      }

      const w = window.innerWidth;
      if (touch.clientX < w * 0.4 && this.touch_look_id === null && !this._mobile_joystick.active) {
        // left side: joystick
        this._mobile_joystick.active = true;
        this._mobile_joystick.id = touch.identifier;
        this._mobile_joystick.base_x = touch.clientX;
        this._mobile_joystick.base_y = touch.clientY;
        this._update_joystick_visual(touch.clientX, touch.clientY, touch.clientX, touch.clientY);
      } else if (this.touch_look_id === null) {
        // right side: look
        this.touch_look_id = touch.identifier;
        this.touch_look_x = touch.clientX;
        this.touch_look_y = touch.clientY;
      }
    }
    e.preventDefault();
  }

  _touch_move(e) {
    if (!this.enabled) return;

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touch_look_id) {
        const dx = touch.clientX - this.touch_look_x;
        const dy = touch.clientY - this.touch_look_y;
        this.mouse_dx += dx * 1.5;
        this.mouse_dy += dy * 1.5;
        this.touch_look_x = touch.clientX;
        this.touch_look_y = touch.clientY;
      } else if (touch.identifier === this._mobile_joystick.id) {
        const dx = touch.clientX - this._mobile_joystick.base_x;
        const dy = touch.clientY - this._mobile_joystick.base_y;
        const max = 60;
        const len = Math.hypot(dx, dy);
        const clamp = len > max ? max / len : 1;
        const cx = dx * clamp;
        const cy = dy * clamp;

        // Normalize to [-1, 1]
        const nx = cx / max;
        const ny = cy / max;

        this.state.right = nx > 0.2;
        this.state.left = nx < -0.2;
        this.state.forward = ny < -0.2;
        this.state.backward = ny > 0.2;

        this._update_joystick_visual(
          this._mobile_joystick.base_x,
          this._mobile_joystick.base_y,
          this._mobile_joystick.base_x + cx,
          this._mobile_joystick.base_y + cy
        );
      }
    }
    e.preventDefault();
  }

  _touch_end(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touch_look_id) {
        this.touch_look_id = null;
      }
      if (touch.identifier === this._mobile_joystick.id) {
        this._mobile_joystick.active = false;
        this._mobile_joystick.id = null;
        this.state.forward = false;
        this.state.backward = false;
        this.state.left = false;
        this.state.right = false;
        const knob = document.getElementById('joystick-knob');
        if (knob) knob.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  _update_joystick_visual(base_x, base_y, cx, cy) {
    const knob = document.getElementById('joystick-knob');
    if (!knob) return;
    const base = knob.parentElement.getBoundingClientRect();
    const dx = cx - (base.left + base.width / 2);
    const dy = cy - (base.top + base.height / 2);
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // ---- Per-frame consumption ----

  consume_look() {
    const dx = this.mouse_dx;
    const dy = this.mouse_dy;
    this.mouse_dx = 0;
    this.mouse_dy = 0;
    return { dx, dy };
  }

  consume_wheel() {
    const w = this.wheel_delta;
    this.wheel_delta = 0;
    return w;
  }

  is_touch_device() {
    return this._is_touch;
  }
}
