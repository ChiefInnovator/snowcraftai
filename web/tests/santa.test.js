const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Visit, TIMING, POINTS } = require('../js/santa.js');

test('Santa waits behind the grove and begins there, rather than entering from the field', () => {
    const santa = new Visit({ random: () => 0 });
    assert.deepEqual([santa.snapshot().x, santa.snapshot().y], POINTS.hidden);
    assert.equal(santa.snapshot().visible, false);
    santa.advance(TIMING.firstDelayMs);
    const entrance = santa.snapshot();
    assert.equal(entrance.phase, 'run-in');
    assert.equal(entrance.frame, 'run_0');
    assert.equal(entrance.lift, 0);
    assert.equal(entrance.flipX, true);
    assert.equal(entrance.behindGrove, true);
    assert.deepEqual([entrance.x, entrance.y], POINTS.hidden);
    santa.advance(180);
    assert.equal(santa.snapshot().frame, 'run_1');
    assert.equal(santa.snapshot().lift, 0);
    assert.ok(santa.snapshot().x < POINTS.hidden[0] && santa.snapshot().x > POINTS.peek[0]);
    santa.advance(TIMING.entranceMs - 180);
    assert.equal(santa.snapshot().phase, 'peek');
    assert.equal(santa.snapshot().flipX, false);
    assert.deepEqual([santa.snapshot().x, santa.snapshot().y], POINTS.peek);
});

test('nose twitch and magical disappearance stay at the grove without an exit run', () => {
    const santa = new Visit({ firstDelayMs: 0 });
    santa.advance(TIMING.peekMs + TIMING.winkMs + TIMING.waveMs);
    const noses = new Set();
    for (let ms = 0; ms < TIMING.noseMs + TIMING.magicMs; ms += 20) {
        const state = santa.snapshot();
        assert.deepEqual([state.x, state.y], POINTS.peek);
        assert.equal(state.behindGrove, true);
        assert.equal(state.flipX, false);
        assert.ok(['nose-twitch', 'magic'].includes(state.phase));
        assert.equal(state.airborne, false);
        if (state.phase === 'nose-twitch') { noses.add(state.frame); assert.equal(state.visible, true); }
        else { assert.equal(state.magicVisible, true); assert.equal(state.visible, state.magicMs < TIMING.flashAtMs); }
        santa.advance(20);
    }
    assert.deepEqual([...noses].sort(), ['nose_center', 'nose_left', 'nose_right']);
    assert.equal(santa.snapshot().visible, false);
    assert.equal(santa.snapshot().magicVisible, false);
});

test('visit includes wink, wrist wave, nose twitch, flash, and lingering magic', () => {
    const santa = new Visit({ firstDelayMs: 0 });
    santa.advance(TIMING.peekMs);
    assert.equal(santa.snapshot().frame, 'wink');
    santa.advance(TIMING.winkMs);
    assert.equal(santa.snapshot().frame, 'wave_a');
    santa.advance(150);
    assert.equal(santa.snapshot().frame, 'wave_b');
    santa.advance(150);
    assert.equal(santa.snapshot().frame, 'wave_c');
    santa.advance(150);
    assert.equal(santa.snapshot().frame, 'wave_b');
    santa.advance(TIMING.waveMs - 450);
    assert.equal(santa.snapshot().phase, 'nose-twitch');
    assert.equal(santa.snapshot().behindGrove, true);
    santa.advance(TIMING.noseMs);
    assert.equal(santa.snapshot().phase, 'magic');
    assert.equal(santa.snapshot().visible, true);
    santa.advance(TIMING.flashAtMs - 1);
    assert.equal(santa.snapshot().visible, true);
    santa.advance(1);
    assert.equal(santa.snapshot().visible, false);
    assert.equal(santa.snapshot().magicVisible, true, 'spell remains after Santa vanishes');
    santa.advance(TIMING.magicMs - TIMING.flashAtMs);
    assert.equal(santa.snapshot().magicVisible, false);
});

test('the full running cycle has eight phases with only two airborne beats', () => {
    const frames = new Set(), airborne = [];
    for (let i = 0; i < 8; i++) {
        const santa = new Visit({ firstDelayMs: 0 });
        santa.advance((i * 2.5 + 0.2) / (POINTS.hidden[0] - POINTS.peek[0]) * TIMING.entranceMs);
        const state = santa.snapshot(); frames.add(state.frame);
        assert.equal(state.frame, 'run_' + i);
        if (state.airborne) airborne.push(i);
    }
    assert.equal(frames.size, 8);
    assert.deepEqual(airborne, [3, 7]);
});

test('finished visits wait a fresh interval and can repeat without stacked timers', () => {
    let randomCalls = 0;
    const santa = new Visit({ firstDelayMs: 0, random: () => { randomCalls++; return 0; } });
    santa.advance(santa.duration);
    assert.equal(randomCalls, 1);
    assert.equal(santa.snapshot().visible, false);
    santa.advance(TIMING.gapMinMs - 1);
    assert.equal(santa.snapshot().visible, false);
    santa.advance(1);
    assert.equal(santa.snapshot().phase, 'run-in');
    assert.equal(santa.snapshot().visits, 2);
    santa.start();
    assert.equal(santa.snapshot().phase, 'run-in');
    assert.equal(randomCalls, 1);
});

test('large time steps agree with ordinary frames and invalid deltas cannot corrupt the visit', () => {
    const a = new Visit({ firstDelayMs: 0, random: () => 0.5 });
    const b = new Visit({ firstDelayMs: 0, random: () => 0.5 });
    a.advance(120000);
    for (let i = 0; i < 12000; i++) b.advance(10);
    assert.deepEqual(a.snapshot(), b.snapshot());
    for (const invalid of [-1, NaN, Infinity]) assert.throws(() => a.advance(invalid), RangeError);
});
