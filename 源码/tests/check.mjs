import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['dist/Common/MV.js', 'dist/js/config.js', 'dist/js/geometry.js']) {
  const absoluteFile = path.join(sourceRoot, file);
  vm.runInContext(fs.readFileSync(absoluteFile, 'utf8'), sandbox, { filename: absoluteFile });
}

const { MV, SOLAR_CONFIG, SolarGeometry } = sandbox;
const close = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≉ ${expected}`);
const transformOrigin = matrix => [matrix[12], matrix[13], matrix[14]];

// Column-major parent · child composition.
const earthOrbit = MV.mult(MV.rotateY(90), MV.translate(6.4, 0, 0));
const earthLocal = MV.mult(MV.rotateZ(23.5), MV.mult(MV.rotateY(42), MV.scalem(.46, .46, .46)));
const earthModel = MV.mult(earthOrbit, earthLocal);
const earthPosition = transformOrigin(earthModel);
close(earthPosition[0], 0);
close(earthPosition[1], 0);
close(earthPosition[2], -6.4);

// The manually constructed Moon orbit tilts the XZ orbit plane by 5.14°.
const moonManual = MV.mult(MV.rotateZ(5.14), MV.mult(MV.rotateY(0), MV.translate(.92, 0, 0)));
const moonOffset = transformOrigin(moonManual);
close(moonOffset[0], Math.cos(MV.radians(5.14)) * .92);
close(moonOffset[1], Math.sin(MV.radians(5.14)) * .92);

// Projection matrices must remain genuinely different.
const p = MV.perspective(43, 16 / 9, .1, 120);
const o = MV.ortho(-23 * 16 / 9, 23 * 16 / 9, -23, 23, -100, 100);
assert.equal(p[11], -1);
assert.equal(o[15], 1);
assert.notDeepEqual(Array.from(p), Array.from(o));

const sphere = SolarGeometry.makeUVSphere(8, 12);
assert.equal(sphere.positions.length / 3, 9 * 13);
assert.equal(sphere.indices.length, 8 * 12 * 6);
assert.equal(SOLAR_CONFIG.planets.length, 8);
assert.ok(SOLAR_CONFIG.planets.find(body => body.name === '土星').ring);
assert.ok(SOLAR_CONFIG.asteroidBelt.count >= 500);

console.log('AP2 matrix, hierarchy, projection and geometry checks: PASS');
