(function (global) {
  'use strict';

  // Visual scale is intentionally compressed; periods keep their relative ordering.
  global.SOLAR_CONFIG = {
    sun: { name: '太阳', radius: 1.65, texture: 'textures/sun.png', color: '#ffb22e', spinPeriod: 25 },
    planets: [
      { name: '水星', radius: 0.22, distance: 3.5, orbitPeriod: 0.24, spinPeriod: 58.6, axialTilt: 0.03, color: '#9e958b' },
      { name: '金星', radius: 0.39, distance: 4.8, orbitPeriod: 0.62, spinPeriod: -243, axialTilt: 177.4, color: '#d9aa65' },
      { name: '地球', radius: 0.46, distance: 6.4, orbitPeriod: 1, spinPeriod: 1, axialTilt: 23.5, color: '#3d82df', texture: 'textures/earth.png',
        moon: { name: '月球', radius: 0.14, distance: 0.92, orbitPeriod: 0.0748, spinPeriod: 27.3, inclination: 5.14, texture: 'textures/moon.png', color: '#c9c9c7' } },
      { name: '火星', radius: 0.31, distance: 8.2, orbitPeriod: 1.88, spinPeriod: 1.03, axialTilt: 25.2, color: '#c85e3b' },
      { name: '木星', radius: 0.92, distance: 11.2, orbitPeriod: 11.86, spinPeriod: 0.41, axialTilt: 3.1, color: '#c9a57c' },
      { name: '土星', radius: 0.78, distance: 14.7, orbitPeriod: 29.46, spinPeriod: 0.45, axialTilt: 26.7, color: '#d9c18d', ring: { inner: 1.04, outer: 1.72 } },
      { name: '天王星', radius: 0.61, distance: 18.0, orbitPeriod: 84.0, spinPeriod: -0.72, axialTilt: 97.8, color: '#7fd6df' },
      { name: '海王星', radius: 0.59, distance: 21.0, orbitPeriod: 164.8, spinPeriod: 0.67, axialTilt: 28.3, color: '#3d64d8' }
    ],
    asteroidBelt: { inner: 9.35, outer: 10.25, count: 520, seed: 2406100102 },
    cameraKeyframes: [
      { eye: [26, 13, 26], target: [0, 0, 0] },
      { eye: [5, 18, 32], target: [1, 0, 0] },
      { eye: [-29, 10, 18], target: [0, 0, 0] },
      { eye: [-20, 7, -28], target: [-1, 0, 0] },
      { eye: [15, 16, -30], target: [0, 0, 0] },
      { eye: [26, 13, 26], target: [0, 0, 0] }
    ]
  };
})(window);
