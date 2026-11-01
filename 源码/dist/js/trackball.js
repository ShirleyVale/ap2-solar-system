(function (global) {
  'use strict';

  function mapToSphere(x, y, rect) {
    let nx = (2 * (x - rect.left) - rect.width) / rect.width;
    let ny = (rect.height - 2 * (y - rect.top)) / rect.height;
    const length2 = nx * nx + ny * ny;
    const nz = length2 <= 1 ? Math.sqrt(1 - length2) : 0;
    if (length2 > 1) {
      const inv = 1 / Math.sqrt(length2); nx *= inv; ny *= inv;
    }
    return [nx, ny, nz];
  }

  function quatMultiply(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }

  function quatFromVectors(a, b) {
    const axis = MV.cross(a, b);
    const w = 1 + MV.dot(a, b);
    const q = w < 1e-6 ? [a[1], -a[0], 0, 0] : [axis[0], axis[1], axis[2], w];
    const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return q.map(v => v / n);
  }

  function rotateVector(q, v) {
    const qv = [v[0], v[1], v[2], 0];
    const qc = [-q[0], -q[1], -q[2], q[3]];
    const result = quatMultiply(quatMultiply(q, qv), qc);
    return result.slice(0, 3);
  }

  class VirtualTrackball {
    constructor(canvas, onTakeover) {
      this.canvas = canvas;
      this.onTakeover = onTakeover;
      this.quaternion = [0, 0, 0, 1];
      this.dragging = false;
      this.previous = null;
      canvas.addEventListener('pointerdown', event => this.down(event));
      window.addEventListener('pointermove', event => this.move(event));
      window.addEventListener('pointerup', () => this.up());
    }
    down(event) {
      this.dragging = true;
      this.previous = mapToSphere(event.clientX, event.clientY, this.canvas.getBoundingClientRect());
      this.canvas.setPointerCapture?.(event.pointerId);
      this.onTakeover();
    }
    move(event) {
      if (!this.dragging) return;
      const current = mapToSphere(event.clientX, event.clientY, this.canvas.getBoundingClientRect());
      const delta = quatFromVectors(this.previous, current);
      this.quaternion = quatMultiply(delta, this.quaternion);
      this.previous = current;
    }
    up() { this.dragging = false; this.previous = null; }
    reset() { this.quaternion = [0, 0, 0, 1]; }
    apply(vector) { return rotateVector(this.quaternion, vector); }
  }

  global.VirtualTrackball = VirtualTrackball;
})(window);
