/* Minimal column-major matrix helpers in the style of the textbook MV.js. */
(function (global) {
  'use strict';

  const radians = degrees => degrees * Math.PI / 180;

  function mat4() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function mult(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }
    return out;
  }

  function translate(x, y, z) {
    const out = mat4();
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  }

  function scalem(x, y, z) {
    const out = mat4();
    out[0] = x; out[5] = y; out[10] = z;
    return out;
  }

  function rotateX(degrees) {
    const c = Math.cos(radians(degrees));
    const s = Math.sin(radians(degrees));
    const out = mat4();
    out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
    return out;
  }

  function rotateY(degrees) {
    const c = Math.cos(radians(degrees));
    const s = Math.sin(radians(degrees));
    const out = mat4();
    out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
    return out;
  }

  function rotateZ(degrees) {
    const c = Math.cos(radians(degrees));
    const s = Math.sin(radians(degrees));
    const out = mat4();
    out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
    return out;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(radians(fovy) / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  function ortho(left, right, bottom, top, near, far) {
    const out = mat4();
    out[0] = 2 / (right - left);
    out[5] = 2 / (top - bottom);
    out[10] = -2 / (far - near);
    out[12] = -(right + left) / (right - left);
    out[13] = -(top + bottom) / (top - bottom);
    out[14] = -(far + near) / (far - near);
    return out;
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function normalize(v) {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }

  function lookAt(eye, at, up) {
    const z = normalize(subtract(eye, at));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    const out = mat4();
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0];
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1];
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2];
    out[12] = -dot(x, eye);
    out[13] = -dot(y, eye);
    out[14] = -dot(z, eye);
    return out;
  }

  function normalMatrix(modelView) {
    const a00 = modelView[0], a01 = modelView[1], a02 = modelView[2];
    const a10 = modelView[4], a11 = modelView[5], a12 = modelView[6];
    const a20 = modelView[8], a21 = modelView[9], a22 = modelView[10];
    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;
    let det = a00 * b01 + a01 * b11 + a02 * b21;
    det = det ? 1 / det : 1;
    return new Float32Array([
      b01 * det,
      (-a22 * a01 + a02 * a21) * det,
      (a12 * a01 - a02 * a11) * det,
      b11 * det,
      (a22 * a00 - a02 * a20) * det,
      (-a12 * a00 + a02 * a10) * det,
      b21 * det,
      (-a21 * a00 + a01 * a20) * det,
      (a11 * a00 - a01 * a10) * det
    ]);
  }

  global.MV = { mat4, mult, translate, scalem, rotateX, rotateY, rotateZ,
    perspective, ortho, lookAt, normalMatrix, normalize, cross, dot, radians };
})(window);
