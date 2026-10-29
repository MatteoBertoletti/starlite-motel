// Truck crash, simulated ONCE at load with a fixed timestep, recorded, then sampled by time.
import * as CANNON from 'cannon-es';

export const CRASH = { pole: [14, 22.6] };

export const CRASH_PARAMS = { X0: 76, Z0: 26.6, V: 24, cabVz: 0, cabW: 0.0, trVz: 0, trW: 0.5, steerAt: 1.6, steerW: -0.18 };
export function bakeCrash(duration = 9, hz = 120, P = CRASH_PARAMS) {
  const w = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  w.allowSleep = true;
  w.solver.iterations = 20;
  const ground = new CANNON.Material('g'), steel = new CANNON.Material('s');
  w.addContactMaterial(new CANNON.ContactMaterial(ground, steel, { friction: 0.0, restitution: 0.05 }));
  w.addContactMaterial(new CANNON.ContactMaterial(steel, steel, { friction: 0.2, restitution: 0.15 }));
  const gb = new CANNON.Body({ mass: 0, material: ground, shape: new CANNON.Plane() });
  gb.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(gb);

  const { X0, Z0, V } = P;
  const cab = new CANNON.Body({ mass: 4500, material: steel, shape: new CANNON.Box(new CANNON.Vec3(1.7, 1.4, 1.25)) });
  cab.position.set(X0, 1.4, Z0); cab.velocity.set(-V, 0, P.cabVz); cab.angularVelocity.set(0, P.cabW, 0);
  cab.linearDamping = 0.02; cab.angularDamping = 0.5;
  const tr = new CANNON.Body({ mass: 9000, material: steel, shape: new CANNON.Box(new CANNON.Vec3(5.5, 1.7, 1.3)) });
  tr.position.set(X0 + 6.8, 1.7, Z0); tr.velocity.set(-V, 0, P.trVz); tr.angularVelocity.set(0, 0, 0);
  tr.linearDamping = 0.02; tr.angularDamping = 0.1;
  [cab, tr].forEach(b => { b.allowSleep = false; w.addBody(b); });
  const hitch = new CANNON.HingeConstraint(cab, tr, {
    pivotA: new CANNON.Vec3(1.5, 0, 0), pivotB: new CANNON.Vec3(-5.3, -0.3, 0),
    axisA: new CANNON.Vec3(0, 1, 0), axisB: new CANNON.Vec3(0, 1, 0), collideConnected: false });
  hitch.collideConnected = false; w.addConstraint(hitch);

  const wood = new CANNON.Material('w');
  w.addContactMaterial(new CANNON.ContactMaterial(ground, wood, { friction: 0.6, restitution: 0.1 }));
  w.addContactMaterial(new CANNON.ContactMaterial(steel, wood, { friction: 0.3, restitution: 0.2 }));
  const pole = new CANNON.Body({ mass: 600, material: wood, shape: new CANNON.Box(new CANNON.Vec3(0.18, 4.5, 0.18)) });
  pole.position.set(CRASH.pole[0], 4.5, CRASH.pole[1]);
  pole.allowSleep = true; pole.sleepSpeedLimit = 0.05; w.addBody(pole); pole.sleep();

  // cannon's box-plane friction is far too grabby at this scale, so tyres are modelled here:
  // braking along the heading, sideways skid across it. Deterministic, applied every fixed step.
  const tyre = (b, aLong, aLat) => {
    if (b.position.y > 2.6) return;
    const fwd = b.quaternion.vmult(new CANNON.Vec3(1, 0, 0)); fwd.y = 0; fwd.normalize();
    const v = b.velocity, vl = v.x * fwd.x + v.z * fwd.z;
    const lx = v.x - fwd.x * vl, lz = v.z - fwd.z * vl, vs = Math.hypot(lx, lz);
    const cl = Math.min(aLong, Math.abs(vl) * hz), cs = Math.min(aLat, vs * hz);
    let fx = -Math.sign(vl) * fwd.x * cl * b.mass, fz = -Math.sign(vl) * fwd.z * cl * b.mass;
    if (vs > 1e-4) { fx -= lx / vs * cs * b.mass; fz -= lz / vs * cs * b.mass; }
    b.applyForce(new CANNON.Vec3(fx, 0, fz));   // at the centre of mass (2nd arg is a RELATIVE point)
  };
  let steered = false;
  w.addEventListener('preStep', () => {
    if (!steered && w.time >= P.steerAt) { steered = true;            // driver yanks the wheel, trailer whips round
      cab.angularVelocity.y += P.steerW; tr.angularVelocity.y += P.trW; }
    const brk = steered ? 1 : 0;      // rolling straight until the swerve, then everything locks up
    tyre(cab, 2.0 * brk, steered ? 9 : 14); tyre(tr, 3.4 * brk, steered ? 4.5 : 14); });

  let hitTime = null;
  pole.addEventListener('collide', e => { if (hitTime === null && (e.body === cab || e.body === tr)) hitTime = w.time; });

  const dt = 1 / hz, n = Math.round(duration * hz), rec = [];
  const snap = b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
  for (let i = 0; i <= n; i++) {
    rec.push({ cab: snap(cab), tr: snap(tr), pole: snap(pole) });
    w.step(dt);
  }
  return { hz, rec, hitTime };
}

// sample: linear position, nlerp quaternion
export function sampleCrash(bake, key, t) {
  const f = Math.max(0, Math.min(bake.rec.length - 1.001, t * bake.hz));
  const i = Math.floor(f), a = f - i, A = bake.rec[i][key], B = bake.rec[i + 1][key];
  const o = A.map((v, k) => v + (B[k] - v) * a);
  let d = A[3] * B[3] + A[4] * B[4] + A[5] * B[5] + A[6] * B[6];
  if (d < 0) for (let k = 3; k < 7; k++) o[k] = A[k] - (B[k] + A[k]) * a + 0 /* flip */;
  const L = Math.hypot(o[3], o[4], o[5], o[6]); for (let k = 3; k < 7; k++) o[k] /= L;
  return o;
}
