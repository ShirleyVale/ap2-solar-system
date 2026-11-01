(function () {
  'use strict';

  const { mat4, mult, translate, scalem, rotateY, rotateZ, perspective, ortho, lookAt, normalMatrix } = MV;
  const config = SOLAR_CONFIG;
  const canvas = document.getElementById('gl-canvas');
  const gl = WebGLUtils.createWebGL2Context(canvas);
  const fallback = document.getElementById('fallback');
  if (!gl) {
    fallback.hidden = false;
    fallback.textContent = '当前浏览器不支持 WebGL 2.0，请使用最新版 Chrome / Edge / Firefox。';
    return;
  }

  const bodyProgram = initShaders(gl, `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec2 aTexCoord;
    uniform mat4 uModelView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;
    out vec3 vNormalEye;
    out vec3 vPositionEye;
    out vec2 vTexCoord;
    void main() {
      vec4 eyePosition = uModelView * vec4(aPosition, 1.0);
      vPositionEye = eyePosition.xyz;
      vNormalEye = normalize(uNormalMatrix * aNormal);
      vTexCoord = aTexCoord;
      gl_Position = uProjection * eyePosition;
    }
  `, `#version 300 es
    precision highp float;
    in vec3 vNormalEye;
    in vec3 vPositionEye;
    in vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform vec3 uTint;
    uniform vec3 uLightPositionEye;
    uniform bool uUseTexture;
    uniform bool uEmissive;
    uniform float uAlpha;
    out vec4 fragColor;
    void main() {
      vec3 albedo = uUseTexture ? texture(uTexture, vTexCoord).rgb : uTint;
      if (uEmissive) {
        float pulse = 0.94 + 0.06 * sin(vTexCoord.x * 80.0 + vTexCoord.y * 31.0);
        fragColor = vec4(albedo * (1.12 * pulse), uAlpha);
        return;
      }
      vec3 lightDirection = normalize(uLightPositionEye - vPositionEye);
      float diffuse = max(dot(normalize(vNormalEye), lightDirection), 0.0);
      vec3 viewDirection = normalize(-vPositionEye);
      vec3 halfVector = normalize(lightDirection + viewDirection);
      float specular = pow(max(dot(normalize(vNormalEye), halfVector), 0.0), 32.0);
      vec3 color = albedo * (0.16 + 0.84 * diffuse) + vec3(0.16) * specular;
      fragColor = vec4(color, uAlpha);
    }
  `);

  const lineProgram = initShaders(gl, `#version 300 es
    in vec3 aPosition;
    uniform mat4 uModelView;
    uniform mat4 uProjection;
    void main() { gl_Position = uProjection * uModelView * vec4(aPosition, 1.0); }
  `, `#version 300 es
    precision highp float;
    uniform vec4 uColor;
    out vec4 fragColor;
    void main() { fragColor = uColor; }
  `);

  const pointProgram = initShaders(gl, `#version 300 es
    in vec4 aPoint;
    uniform mat4 uView;
    uniform mat4 uProjection;
    void main() {
      vec4 eye = uView * vec4(aPoint.xyz, 1.0);
      gl_Position = uProjection * eye;
      gl_PointSize = clamp(aPoint.w * 680.0 / max(1.0, -eye.z), 1.0, 5.5);
    }
  `, `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      if (dot(p, p) > 1.0) discard;
      float shade = 0.6 + 0.4 * max(0.0, 1.0 - length(p));
      fragColor = vec4(vec3(0.56, 0.48, 0.39) * shade, 0.92);
    }
  `);

  const bodyLoc = {
    modelView: gl.getUniformLocation(bodyProgram, 'uModelView'),
    projection: gl.getUniformLocation(bodyProgram, 'uProjection'),
    normal: gl.getUniformLocation(bodyProgram, 'uNormalMatrix'),
    texture: gl.getUniformLocation(bodyProgram, 'uTexture'),
    tint: gl.getUniformLocation(bodyProgram, 'uTint'),
    light: gl.getUniformLocation(bodyProgram, 'uLightPositionEye'),
    useTexture: gl.getUniformLocation(bodyProgram, 'uUseTexture'),
    emissive: gl.getUniformLocation(bodyProgram, 'uEmissive'),
    alpha: gl.getUniformLocation(bodyProgram, 'uAlpha')
  };
  const lineLoc = {
    modelView: gl.getUniformLocation(lineProgram, 'uModelView'),
    projection: gl.getUniformLocation(lineProgram, 'uProjection'),
    color: gl.getUniformLocation(lineProgram, 'uColor')
  };
  const pointLoc = {
    view: gl.getUniformLocation(pointProgram, 'uView'),
    projection: gl.getUniformLocation(pointProgram, 'uProjection')
  };

  function createMesh(data) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attributes = [
      ['aPosition', data.positions, 3],
      ['aNormal', data.normals, 3],
      ['aTexCoord', data.texcoords, 2]
    ];
    attributes.forEach(([name, values, size]) => {
      const location = gl.getAttribLocation(bodyProgram, name);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    });
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: data.indices.length };
  }

  function createLineMesh(data) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(lineProgram, 'aPosition');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: data.positions.length / 3 };
  }

  const sphereMesh = createMesh(SolarGeometry.makeUVSphere());
  const ringMesh = createMesh(SolarGeometry.makeRing());
  const orbitMesh = createLineMesh(SolarGeometry.makeOrbit());

  const asteroidVao = gl.createVertexArray();
  gl.bindVertexArray(asteroidVao);
  const asteroidData = new Float32Array(SolarGeometry.makeAsteroids(config.asteroidBelt));
  const asteroidBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, asteroidBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, asteroidData, gl.STATIC_DRAW);
  const asteroidLocation = gl.getAttribLocation(pointProgram, 'aPoint');
  gl.enableVertexAttribArray(asteroidLocation);
  gl.vertexAttribPointer(asteroidLocation, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }

  function finishTexture(texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  function loadBitmapTexture(url, tint) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const color = hexToRgb(tint).map(v => Math.round(v * 255));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([color[0], color[1], color[2], 255]));
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Image rows start at the top; WebGL UV origin is bottom-left.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      finishTexture(texture);
    };
    image.onerror = () => console.warn('纹理载入失败，使用占位色：', url);
    image.src = url;
    return texture;
  }

  function makeProceduralTexture(color, seed) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const base = hexToRgb(color).map(v => Math.round(v * 255));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    let value = seed;
    const random = () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let y = 0; y < c.height; y += 3) {
      const wave = Math.sin(y * 0.09 + seed) * 18;
      ctx.fillStyle = `rgba(${Math.max(0, base[0] + wave)},${Math.max(0, base[1] + wave)},${Math.max(0, base[2] + wave)},.32)`;
      ctx.fillRect(0, y, c.width, 2);
    }
    for (let i = 0; i < 220; i++) {
      const alpha = 0.035 + random() * 0.08;
      ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(30,20,12,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(random() * c.width, random() * c.height, 8 + random() * 45, 2 + random() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    finishTexture(texture);
    return texture;
  }

  const textures = new Map();
  textures.set('太阳', loadBitmapTexture(config.sun.texture, config.sun.color));
  config.planets.forEach((planet, index) => {
    textures.set(planet.name, planet.texture
      ? loadBitmapTexture(planet.texture, planet.color)
      : makeProceduralTexture(planet.color, 100 + index * 17));
    if (planet.moon) textures.set(planet.moon.name, loadBitmapTexture(planet.moon.texture, planet.moon.color));
  });
  textures.set('土星环', makeProceduralTexture('#c9b887', 555));

  const state = {
    orbitSpeed: 1,
    spinSpeed: 1,
    earthTilt: 23.5,
    showOrbits: true,
    projection: 'perspective',
    tourActive: true,
    tourPaused: false,
    tourTime: 0,
    simulationTime: 0,
    manualDistance: 36,
    alignment: 'none'
  };

  const trackball = new VirtualTrackball(canvas, () => {
    state.tourActive = false;
    state.tourPaused = true;
    updateStatus();
  });

  const controls = {
    orbitSpeed: document.getElementById('orbit-speed'),
    spinSpeed: document.getElementById('spin-speed'),
    earthTilt: document.getElementById('earth-tilt'),
    showOrbits: document.getElementById('show-orbits'),
    projection: document.getElementById('projection-button'),
    tour: document.getElementById('tour-button'),
    reset: document.getElementById('reset-button'),
    alignment: document.getElementById('alignment'),
    orbitValue: document.getElementById('orbit-value'),
    spinValue: document.getElementById('spin-value'),
    tiltValue: document.getElementById('tilt-value')
  };

  function bindRange(element, target, output, suffix = '×') {
    element.addEventListener('input', () => {
      state[target] = Number(element.value);
      output.textContent = `${Number(element.value).toFixed(target === 'earthTilt' ? 1 : 1)}${suffix}`;
    });
  }
  bindRange(controls.orbitSpeed, 'orbitSpeed', controls.orbitValue);
  bindRange(controls.spinSpeed, 'spinSpeed', controls.spinValue);
  bindRange(controls.earthTilt, 'earthTilt', controls.tiltValue, '°');
  controls.showOrbits.addEventListener('change', () => state.showOrbits = controls.showOrbits.checked);
  controls.projection.addEventListener('click', toggleProjection);
  controls.tour.addEventListener('click', toggleTour);
  controls.reset.addEventListener('click', resetView);
  controls.alignment.addEventListener('change', () => {
    state.alignment = controls.alignment.value;
    document.getElementById('eclipse-note').hidden = state.alignment === 'none';
    updateStatus();
  });

  function toggleProjection() {
    state.projection = state.projection === 'perspective' ? 'orthographic' : 'perspective';
    controls.projection.textContent = state.projection === 'perspective' ? '透视投影' : '正交投影';
    controls.projection.setAttribute('aria-pressed', state.projection === 'orthographic');
    updateStatus();
  }

  function toggleTour() {
    if (!state.tourActive) {
      state.tourActive = true;
      state.tourPaused = false;
    } else {
      state.tourPaused = !state.tourPaused;
    }
    updateStatus();
  }

  function resetView() {
    state.tourActive = true;
    state.tourPaused = false;
    state.tourTime = 0;
    state.manualDistance = 36;
    state.alignment = 'none';
    controls.alignment.value = 'none';
    document.getElementById('eclipse-note').hidden = true;
    trackball.reset();
    updateStatus();
  }

  window.addEventListener('keydown', event => {
    if (event.code === 'KeyO') toggleProjection();
    if (event.code === 'Space') {
      event.preventDefault();
      toggleTour();
    }
    if (event.code === 'KeyR') resetView();
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    state.tourActive = false;
    state.tourPaused = true;
    state.manualDistance = Math.max(12, Math.min(64, state.manualDistance * Math.exp(event.deltaY * 0.001)));
    updateStatus();
  }, { passive: false });

  function updateStatus() {
    document.getElementById('projection-status').textContent = state.projection === 'perspective' ? '透视' : '正交';
    const cameraLabel = !state.tourActive ? '轨迹球手动' : state.tourPaused ? '漫游已暂停' : '自动漫游';
    document.getElementById('camera-status').textContent = cameraLabel;
    document.getElementById('alignment-status').textContent = state.alignment === 'none' ? '自由运行' : state.alignment === 'solar' ? '日食对齐' : '月食对齐';
    controls.tour.textContent = !state.tourActive ? '恢复漫游' : state.tourPaused ? '继续漫游' : '暂停漫游';
  }

  function mix3(a, b, t) {
    return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
  }

  function cameraAtTime(time) {
    if (!state.tourActive) {
      return { eye: trackball.apply([0, 10, state.manualDistance]), target: [0, 0, 0] };
    }
    if (state.alignment !== 'none') {
      return { eye: [3.2, 7.5, 15], target: [3.2, 0, 0] };
    }
    const frames = config.cameraKeyframes;
    const segmentLength = 4.8;
    const cycle = (frames.length - 1) * segmentLength;
    const local = (time % cycle) / segmentLength;
    const index = Math.min(frames.length - 2, Math.floor(local));
    const rawT = local - index;
    const smoothT = rawT * rawT * (3 - 2 * rawT);
    return {
      eye: mix3(frames[index].eye, frames[index + 1].eye, smoothT),
      target: mix3(frames[index].target, frames[index + 1].target, smoothT)
    };
  }

  function transformPoint(matrix, point) {
    const [x, y, z] = point;
    return [
      matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
      matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
      matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
    ];
  }

  function drawBody(model, view, projectionMatrix, texture, color, emissive = false, alpha = 1) {
    gl.useProgram(bodyProgram);
    const modelView = mult(view, model);
    gl.uniformMatrix4fv(bodyLoc.modelView, false, modelView);
    gl.uniformMatrix4fv(bodyLoc.projection, false, projectionMatrix);
    gl.uniformMatrix3fv(bodyLoc.normal, false, normalMatrix(modelView));
    gl.uniform3fv(bodyLoc.tint, hexToRgb(color));
    gl.uniform3fv(bodyLoc.light, transformPoint(view, [0, 0, 0]));
    gl.uniform1i(bodyLoc.useTexture, texture ? 1 : 0);
    gl.uniform1i(bodyLoc.emissive, emissive ? 1 : 0);
    gl.uniform1f(bodyLoc.alpha, alpha);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(bodyLoc.texture, 0);
    gl.bindVertexArray(sphereMesh.vao);
    gl.drawElements(gl.TRIANGLES, sphereMesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function drawRing(model, view, projectionMatrix) {
    gl.useProgram(bodyProgram);
    const modelView = mult(view, model);
    gl.uniformMatrix4fv(bodyLoc.modelView, false, modelView);
    gl.uniformMatrix4fv(bodyLoc.projection, false, projectionMatrix);
    gl.uniformMatrix3fv(bodyLoc.normal, false, normalMatrix(modelView));
    gl.uniform3fv(bodyLoc.tint, hexToRgb('#c9b887'));
    gl.uniform3fv(bodyLoc.light, transformPoint(view, [0, 0, 0]));
    gl.uniform1i(bodyLoc.useTexture, 1);
    gl.uniform1i(bodyLoc.emissive, 0);
    gl.uniform1f(bodyLoc.alpha, 0.78);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures.get('土星环'));
    gl.uniform1i(bodyLoc.texture, 0);
    gl.bindVertexArray(ringMesh.vao);
    gl.drawElements(gl.TRIANGLES, ringMesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function drawOrbit(model, view, projectionMatrix, color = [0.38, 0.48, 0.68, 0.32]) {
    gl.useProgram(lineProgram);
    gl.uniformMatrix4fv(lineLoc.modelView, false, mult(view, model));
    gl.uniformMatrix4fv(lineLoc.projection, false, projectionMatrix);
    gl.uniform4fv(lineLoc.color, color);
    gl.bindVertexArray(orbitMesh.vao);
    gl.drawArrays(gl.LINE_STRIP, 0, orbitMesh.count);
  }

  function drawAsteroids(view, projectionMatrix) {
    gl.useProgram(pointProgram);
    gl.uniformMatrix4fv(pointLoc.view, false, view);
    gl.uniformMatrix4fv(pointLoc.projection, false, projectionMatrix);
    gl.bindVertexArray(asteroidVao);
    gl.drawArrays(gl.POINTS, 0, asteroidData.length / 4);
  }

  function drawScene(view, projectionMatrix) {
    if (state.showOrbits) {
      config.planets.forEach(planet => drawOrbit(scalem(planet.distance, 1, planet.distance), view, projectionMatrix));
    }

    const sunSpin = state.simulationTime * 4 * state.spinSpeed;
    const sunModel = mult(rotateY(sunSpin), scalem(config.sun.radius, config.sun.radius, config.sun.radius));
    drawBody(sunModel, view, projectionMatrix, textures.get('太阳'), config.sun.color, true);

    drawAsteroids(view, projectionMatrix);

    config.planets.forEach((planet, index) => {
      let orbitAngle = state.simulationTime * 12 / planet.orbitPeriod * state.orbitSpeed + index * 37;
      if (planet.name === '地球' && state.alignment !== 'none') orbitAngle = 0;
      const orbitFrame = mult(rotateY(orbitAngle), translate(planet.distance, 0, 0));
      const tilt = planet.name === '地球' ? state.earthTilt : planet.axialTilt;
      const spinAngle = state.simulationTime * 80 / planet.spinPeriod * state.spinSpeed;

      // Column vectors: local spin/scale happen first, then axial tilt; the whole body is
      // finally attached to the parent orbitFrame. This is the required “先转后挂”.
      const localBody = mult(rotateZ(tilt), mult(rotateY(spinAngle), scalem(planet.radius, planet.radius, planet.radius)));
      const model = mult(orbitFrame, localBody);
      drawBody(model, view, projectionMatrix, textures.get(planet.name), planet.color);

      if (planet.ring) {
        const ringRadius = planet.radius * planet.ring.outer;
        const ringModel = mult(orbitFrame, mult(rotateZ(tilt), scalem(ringRadius, ringRadius, ringRadius)));
        drawRing(ringModel, view, projectionMatrix);
      }

      if (planet.moon) {
        const moon = planet.moon;
        let moonAngle = state.simulationTime * 34 / moon.orbitPeriod * state.orbitSpeed;
        if (state.alignment === 'solar') moonAngle = 180;
        if (state.alignment === 'lunar') moonAngle = 0;

        // Manual matrix composition required by AP2:
        // M_moonOrbit = Rz(inclination) · Ry(revolution) · T(distance)
        // No scene-graph helper hides the order; each MV.js matrix is multiplied explicitly.
        const moonTiltMatrix = rotateZ(moon.inclination);
        const moonRevolutionMatrix = rotateY(moonAngle);
        const moonOffsetMatrix = translate(moon.distance, 0, 0);
        const moonOrbitMatrix = mult(moonTiltMatrix, mult(moonRevolutionMatrix, moonOffsetMatrix));
        const moonFrame = mult(orbitFrame, moonOrbitMatrix);

        if (state.showOrbits) {
          const moonOrbitGuide = mult(orbitFrame, mult(moonTiltMatrix, scalem(moon.distance, 1, moon.distance)));
          drawOrbit(moonOrbitGuide, view, projectionMatrix, [0.68, 0.76, 0.9, 0.5]);
        }
        const moonSpin = rotateY(state.simulationTime * 16 / moon.spinPeriod * state.spinSpeed);
        const moonModel = mult(moonFrame, mult(moonSpin, scalem(moon.radius, moon.radius, moon.radius)));
        drawBody(moonModel, view, projectionMatrix, textures.get('月球'), moon.color);
      }
    });
  }

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.005, 0.008, 0.03, 0);

  let previousTime = performance.now();
  function render(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    state.simulationTime += dt;
    if (state.tourActive && !state.tourPaused) state.tourTime += dt;
    WebGLUtils.resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const camera = cameraAtTime(state.tourTime);
    const view = lookAt(camera.eye, camera.target, [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const projectionMatrix = state.projection === 'perspective'
      ? perspective(43, aspect, 0.1, 120)
      : ortho(-23 * aspect, 23 * aspect, -23, 23, -100, 100);
    drawScene(view, projectionMatrix);
    requestAnimationFrame(render);
  }

  updateStatus();
  requestAnimationFrame(render);
})();
