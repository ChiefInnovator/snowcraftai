const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/motion.js');
const paths = require('../assets/walkon.json');
const P = require('../js/parity.js');

test('HD paths interpolate every recorded route without mutating Director points or arrival times', () => {
    const original = JSON.stringify(paths);
    paths.forEach((level, n) => [...level.reds, ...level.greens].forEach(points => {
        const fps = P.scoreTempoFps(n + 1), path = M.makePath(points, fps);
        points.forEach((p, i) => {
            const s = M.samplePath(path, i * 1000 / fps + 1e-7);
            assert.ok(Math.abs(s.x - p.x) < .001); assert.ok(Math.abs(s.y - p.y) < .001);
        });
        const last = points.at(-1), end = M.samplePath(path, path.duration);
        assert.equal(end.x, last.x); assert.equal(end.y, last.y); assert.equal(end.moving, false);
        assert.equal(path.duration, points.length * 1000 / fps);
    }));
    assert.equal(JSON.stringify(paths), original);
});

test('HD movement has intermediate positions and brakes into the original endpoint', () => {
    const p = M.makePath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 10 }, { x: 20, y: 10 }], 10);
    assert.equal(M.samplePath(p, 50).x, 5);
    assert.equal(M.samplePath(p, 150).x, 17.5);
    assert.equal(M.samplePath(p, 200).x, 20);
    assert.equal(M.samplePath(p, 217).settled, 17);
});

test('distance based gait uses all eight phases, reverses, and varies by child', () => {
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => M.gait(i * 3.5)), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => M.gait(i * 3.5, 0, true)), [0, 7, 6, 5, 4, 3, 2, 1]);
    assert.equal(M.gait(0, 3), 3); assert.equal(M.gait(28), 0);
});

test('projectiles draw ahead between ticks and meet the authoritative next step', () => {
    const b = { gx: 100, gy: 90, phase: 'fly', frame: 0, flyStep: { x: -20, y: -10 }, dropStep: { x: -10, y: -5 } };
    const before = JSON.stringify(b);
    assert.equal(M.ballSample(b, .5).x, 90);
    assert.equal(M.ballSample(b, 1).x, 80);
    assert.equal(M.ballSample(b, .8, .8).x, 100);
    assert.equal(M.ballSample(b, .9, .8).x, 90);
    assert.equal(JSON.stringify(b), before);
    b.phase = 'drop'; b.frame = 3;
    assert.equal(M.ballSample(b, 1).height, 0);
    b.phase = 'melt'; assert.equal(M.ballSample(b, .5).x, 100);
});

test('HD pose manifest covers both eight-phase gaits, actions and original contact geometry', () => {
    const manifest = require('../assets/hd/motion/manifest.json');
    assert.equal(Object.keys(manifest.frames).length, 56);
    assert.equal(Object.keys(manifest.legacy).length, 35);
    for (const id of M.IDS) {
        const f = manifest.frames[id]; assert.ok(f, id); assert.ok(f.shadow);
        assert.equal(f.pixelScale, 4); assert.equal(f.reg[1], 48);
        if (!f.noContact) assert.ok(f.contactPoints.length > 0, id);
        f.contactPoints.forEach(c => assert.ok(Math.abs(c.y - f.groundOffset) <= 1));
    }
});

test('Red injury poses keep the charging body size and the falling body anchor', () => {
    const manifest = require('../assets/hd/motion/manifest.json');
    const pack = require('../assets/hd/characters/manifest.json');
    const ready = manifest.frames.R_ready, cock = manifest.frames.R_cock, fall = manifest.frames.R_fall;
    const injured = pack.frames.filter(f => ['R hit', 'R hit2', 'R dead'].includes(f.name));
    for (const frame of injured) {
        const before = JSON.stringify(frame), geometry = manifest.legacy[frame.key];
        const result = M.registerRedInjury(frame, geometry, ready, manifest.teams.R.foot, fall, frame.name === 'R dead');
        const offset = frame.reg.map((v, i) => v * result.presentationScale - result.reg[i]);
        const centre = geometry.bodyCentre.map((v, i) => v * result.presentationScale + offset[i]);
        assert.ok(Math.abs(result.bodyArea / cock.bodyArea - 1) < .02, frame.file);
        centre.forEach((v, i) => assert.ok(Math.abs(v - result.bodyCentre[i]) < 1e-10));
        assert.ok(Math.abs(result.w / frame.w - result.h / frame.h) < 1e-12, 'uniform body scale');
        assert.ok(Math.abs(result.shadow.w / frame.shadow.w - result.shadow.h / frame.shadow.h) < 1e-12);
        assert.equal(JSON.stringify(frame), before, 'canonical geometry stays untouched');
    }
});
