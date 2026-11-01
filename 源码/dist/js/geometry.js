(function (global) {
  'use strict';

  function makeUVSphere(latBands = 32, lonBands = 48) {
    const positions = [], normals = [], texcoords = [], indices = [];
    for (let lat = 0; lat <= latBands; lat++) {
      const theta = lat * Math.PI / latBands;
      const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = lon * Math.PI * 2 / lonBands;
        const x = Math.cos(phi) * sinTheta;
        const y = cosTheta;
        const z = Math.sin(phi) * sinTheta;
        positions.push(x, y, z);
        normals.push(x, y, z);
        texcoords.push(1 - lon / lonBands, 1 - lat / latBands);
      }
    }
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const a = lat * (lonBands + 1) + lon;
        const b = a + lonBands + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { positions, normals, texcoords, indices };
  }

  function makeRing(segments = 160) {
    const positions = [], normals = [], texcoords = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const a = i * Math.PI * 2 / segments;
      const c = Math.cos(a), s = Math.sin(a);
      positions.push(c * 0.58, 0, s * 0.58, c, 0, s);
      normals.push(0, 1, 0, 0, 1, 0);
      texcoords.push(0, i / segments, 1, i / segments);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = a + 2;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return { positions, normals, texcoords, indices };
  }

  function makeOrbit(segments = 192) {
    const positions = [];
    for (let i = 0; i <= segments; i++) {
      const a = i * Math.PI * 2 / segments;
      positions.push(Math.cos(a), 0, Math.sin(a));
    }
    return { positions };
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value = (1664525 * value + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function makeAsteroids(config) {
    const random = seededRandom(config.seed);
    const data = [];
    for (let i = 0; i < config.count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = config.inner + (config.outer - config.inner) * random();
      data.push(Math.cos(angle) * radius, (random() - 0.5) * 0.32, Math.sin(angle) * radius, 0.025 + random() * 0.055);
    }
    return data;
  }

  global.SolarGeometry = { makeUVSphere, makeRing, makeOrbit, makeAsteroids };
})(window);
