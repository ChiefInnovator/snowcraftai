/** Santa's decorative visit. It has its own clock/RNG and never joins a team. */
(function (root, factory) {
    const api = factory();
    root.SnowcraftSanta = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const RUN_CYCLE = Array.from({ length: 8 }, (_, i) => 'run_' + i);
    const NOSE_CYCLE = ['nose_center', 'nose_left', 'nose_right', 'nose_left', 'nose_center', 'nose_right', 'nose_left', 'nose_center'];
    const FRAMES = ['peek', 'wink', 'wave_a', 'wave_b', 'wave_c', 'nose_left', 'nose_center', 'nose_right', ...RUN_CYCLE,
        ...Array.from({ length: 4 }, (_, i) => 'turn_quarter_' + i), ...Array.from({ length: 4 }, (_, i) => 'turn_front_' + i)];
    const WAVE_CYCLE = ['wave_a', 'wave_b', 'wave_c', 'wave_b'];
    const canFlip = frame => frame.startsWith('run_') || frame.startsWith('turn_quarter_');
    const TIMING = { firstDelayMs: 12000, peekMs: 2800, winkMs: 1000, waveMs: 1800, noseMs: 900, magicMs: 1700,
        flashAtMs: 520, entranceMs: 2400, gapMinMs: 35000, gapMaxMs: 50000 };
    const POINTS = { hidden: [520, 76], peek: [464, 76] };
    const lerp = (a, b, t) => a + (b - a) * t;
    function gait(result, distance, heading) {
        const step = Math.floor(distance / 2.5), phase = step % RUN_CYCLE.length;
        result.runPhase = phase; result.flipX = heading > 105;
        if (heading > 165 || heading < 15) {
            result.frame = RUN_CYCLE[phase]; result.facing = heading > 165 ? 180 : 0;
        } else if (heading >= 75 && heading <= 105) {
            result.frame = 'turn_front_' + step % 4; result.facing = 90; result.flipX = false;
        } else {
            const angle = heading > 90 ? 180 - heading : heading;
            const view = Math.min(3, Math.max(0, Math.floor((angle - 15) / 15)));
            result.frame = 'turn_quarter_' + view;
            result.facing = [22.5, 45, 60, 75][view];
            if (result.flipX) result.facing = 180 - result.facing;
        }
        result.airborne = result.frame === 'run_3' || result.frame === 'run_7';
    }

    class Visit {
        constructor({ random = Math.random, firstDelayMs = TIMING.firstDelayMs, gapMinMs = TIMING.gapMinMs,
            gapMaxMs = TIMING.gapMaxMs } = {}) {
            this.random = random;
            this.clock = 0;
            this.nextAt = firstDelayMs;
            this.gapMinMs = gapMinMs;
            this.gapMaxMs = gapMaxMs;
            this.completed = 0;
        }
        get duration() { return TIMING.peekMs + TIMING.winkMs + TIMING.waveMs + TIMING.noseMs + TIMING.magicMs; }
        advance(ms) {
            if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Invalid Santa elapsed time');
            this.clock += ms;
            while (this.clock >= this.nextAt + this.duration) {
                this.completed++;
                this.nextAt += this.duration + lerp(this.gapMinMs, this.gapMaxMs, this.random());
            }
            return this.snapshot();
        }
        start() { this.nextAt = this.clock; return this.snapshot(); }
        snapshot() {
            const t = this.clock - this.nextAt;
            const result = { phase: 'hidden', visible: false, frame: 'peek', x: POINTS.hidden[0], y: POINTS.hidden[1],
                behindGrove: true, flipX: false, lift: 0, facing: 90, airborne: false, visits: this.completed,
                magicVisible: false, magicMs: null };
            if (t < 0) return result;
            result.visible = true; result.visits++;
            result.x = POINTS.peek[0];
            result.y = POINTS.peek[1];
            if (t < TIMING.entranceMs) {
                result.phase = 'run-in';
                result.x = lerp(POINTS.hidden[0], POINTS.peek[0], t / TIMING.entranceMs);
                const turn = Math.max(0, (t - TIMING.entranceMs + 180) / 180);
                gait(result, POINTS.hidden[0] - result.x, lerp(180, 90, turn));
                return result;
            }
            if (t < TIMING.peekMs) { result.phase = 'peek'; return result; }
            if (t < TIMING.peekMs + TIMING.winkMs) {
                result.phase = 'wink'; result.frame = 'wink'; return result;
            }
            if (t < TIMING.peekMs + TIMING.winkMs + TIMING.waveMs) {
                result.phase = 'wave';
                result.frame = WAVE_CYCLE[Math.floor((t - TIMING.peekMs - TIMING.winkMs) / 150) % WAVE_CYCLE.length];
                return result;
            }
            const spell = t - TIMING.peekMs - TIMING.winkMs - TIMING.waveMs;
            if (spell < TIMING.noseMs) {
                result.phase = 'nose-twitch';
                result.frame = NOSE_CYCLE[Math.min(NOSE_CYCLE.length - 1, Math.floor(spell / 100))];
                return result;
            }
            result.phase = 'magic'; result.frame = 'nose_center';
            result.magicMs = spell - TIMING.noseMs; result.magicVisible = true;
            // He vanishes at the peak of the spell, in place. Sparkles remain
            // afterward; his body, boot contacts and cast shadow all leave now.
            result.visible = result.magicMs < TIMING.flashAtMs;
            return result;
        }
    }

    function createMagic(scene) {
        for (const scale of [1, 8]) {
            const key = 'santa_magic_glow_' + scale;
            if (scene.textures.exists(key)) continue;
            const texture = scene.textures.createCanvas(key, 64 * scale, 64 * scale), ctx = texture.getContext();
            const g = ctx.createRadialGradient(32 * scale, 32 * scale, 0, 32 * scale, 32 * scale, 32 * scale);
            g.addColorStop(0, '#fffef0'); g.addColorStop(.18, 'rgba(255,245,194,.95)');
            g.addColorStop(.4, 'rgba(255,206,98,.68)'); g.addColorStop(.68, 'rgba(152,224,241,.24)');
            g.addColorStop(1, 'rgba(152,224,241,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64 * scale, 64 * scale);
            texture.refresh(); texture.setFilter(scale === 8 ? 0 : 1);
        }
        const halo = scene.add.image(0, 0, 'santa_magic_glow_1').setDepth(-8.1).setVisible(false);
        const flash = scene.add.image(0, 0, 'santa_magic_glow_1').setDepth(-6.8).setVisible(false);
        const ribbons = scene.add.graphics().setDepth(-6.7), sparks = scene.add.graphics().setDepth(-6.6);
        const palette = [0xf6ce64, 0xfff7d6, 0x8ad9ee, 0xe2ac38];
        let active = 0;
        function render(state, hd) {
            ribbons.clear(); sparks.clear(); halo.setVisible(false); flash.setVisible(false); active = 0;
            if (!state.magicVisible && state.phase !== 'nose-twitch') return;
            const snap = v => hd ? v : Math.round(v), cx = state.x - 3, cy = state.y - 22;
            function star(x, y, radius, alpha, colour, rotate = 0) {
                if (alpha <= .01) return;
                active++;
                if (!hd) {
                    const r = Math.max(1, Math.round(radius)), px = Math.round(x), py = Math.round(y);
                    sparks.fillStyle(colour, alpha).fillRect(px - r, py, r * 2 + 1, 1).fillRect(px, py - r, 1, r * 2 + 1);
                    sparks.fillStyle(0xfffdf0, alpha).fillRect(px, py, 1, 1);
                    return;
                }
                const points = Array.from({ length: 8 }, (_, i) => {
                    const a = rotate + i * Math.PI / 4, r = radius * (i % 2 ? .23 : 1);
                    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
                });
                sparks.fillStyle(colour, alpha).fillPoints(points, true);
                sparks.fillStyle(0xfffef5, alpha).fillCircle(x, y, Math.max(.3, radius * .17));
            }
            if (state.phase === 'nose-twitch') {
                // A tiny glint links the visible nose wiggle to the spell.
                star(cx + 5, cy - 10, state.frame === 'nose_center' ? 1.2 : 1.8, .8, palette[0]);
                return;
            }
            const ms = state.magicMs, charge = Math.min(1, ms / TIMING.flashAtMs), burst = ms - TIMING.flashAtMs;
            const after = Math.max(0, burst / (TIMING.magicMs - TIMING.flashAtMs));
            const texture = 'santa_magic_glow_' + (hd ? 8 : 1);
            halo.setTexture(texture).setPosition(cx, cy).setDisplaySize(42 + charge * 18, 52 + charge * 14)
                .setAlpha(burst < 0 ? .12 + charge * .36 : .48 * (1 - after) ** 2).setVisible(true);
            // Dense one-pixel spirals obscure the small Original-mode face.
            // Its charge uses a few clean orbiting stars outside the silhouette.
            if (hd && burst < 140) {
                const alpha = burst < 0 ? charge ** 2 * .72 : Math.max(0, 1 - burst / 140) * .72;
                ribbons.lineStyle(hd ? .7 : 1, palette[0], alpha);
                for (let i = 0; i < 42; i++) {
                    const p = i / 41, theta = p * Math.PI * 4 + ms / 100, radius = 14 - p * 6;
                    const x = snap(cx + Math.cos(theta) * radius), y = snap(state.y - 2 - p * 34 + Math.sin(theta) * 2);
                    if (!i) ribbons.beginPath().moveTo(x, y); else ribbons.lineTo(x, y);
                }
                ribbons.strokePath();
            }
            const envelope = burst < 0 ? Math.max(0, 1 + burst / 150) : Math.max(0, 1 - burst / 210);
            if (envelope > 0) {
                flash.setTexture(texture).setPosition(cx, cy).setDisplaySize(64 * (.7 + envelope * .3), 64 * (.7 + envelope * .3))
                    .setAlpha(envelope).setVisible(true);
                star(cx, cy, 23 * envelope, envelope, palette[0], Math.PI / 4);
                star(cx, cy, 18 * envelope, envelope, 0xfffdf0);
            }
            const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
            const count = hd ? (coarse ? 24 : 36) : (coarse ? 8 : 12);
            for (let i = 0; i < count; i++) {
                const angle = i * 2.399963 + (burst < 0 ? ms / 130 : after * .6);
                const radius = burst < 0 ? (hd ? 22 - charge * 14 + i % 4 : 24 + i % 3) : 4 + i % 5 * 2 + after * (14 + i % 7 * 2);
                const x = snap(cx + Math.cos(angle) * radius);
                const y = snap(burst < 0 ? cy + Math.sin(angle) * radius * .8
                    : cy + Math.sin(angle) * radius * .72 - after * (12 + i % 4 * 3));
                const twinkle = .55 + .45 * Math.sin(ms / 52 + i * 1.8) ** 2;
                const alpha = burst < 0 ? (.3 + charge * .7) * twinkle : (1 - after) ** 1.5 * twinkle;
                star(x, y, (hd ? (i % 5 === 0 ? 3.1 : 1.1 + i % 3 * .45) : (i % 4 === 0 ? 2 : 1))
                    * (burst < 0 ? 1 : 1 - after * .6), alpha, palette[i % palette.length], angle * .2);
            }
        }
        return { render, halo, flash, ribbons, sparks, snapshot: () => ({ visible: active > 0, particles: active, flash: flash.visible }),
            destroy: () => [halo, flash, ribbons, sparks].forEach(o => o.destroy()) };
    }

    function create(scene, artwork, options) {
        const visit = new Visit(options);
        const specs = new Map(scene.cache.json.get('santa').frames.map(frame => [frame.id, frame]));
        const grove = scene.add.image(-4, 0, 'santa_grove').setOrigin(0).setDepth(-7);
        artwork.apply(grove, 'santa_grove');
        const sprite = scene.add.image(POINTS.hidden[0], POINTS.hidden[1], 'santa_peek')
            .setOrigin(specs.get('peek').reg[0] / 64, specs.get('peek').reg[1] / 64).setDepth(-8).setVisible(false);
        artwork.apply(sprite, 'santa_peek');
        for (const scale of [1, 8]) {
            const key = 'santa_sole_contact_' + scale;
            if (scene.textures.exists(key)) continue;
            const texture = scene.textures.createCanvas(key, 16 * scale, 4 * scale);
            const ctx = texture.getContext(); ctx.scale(scale, scale); ctx.translate(8, 2); ctx.scale(1, 0.25);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
            gradient.addColorStop(0, 'rgba(30,49,65,0.68)'); gradient.addColorStop(0.5, 'rgba(30,49,65,0.46)');
            gradient.addColorStop(1, 'rgba(30,49,65,0)'); ctx.fillStyle = gradient; ctx.fillRect(-8, -8, 16, 16);
            texture.refresh(); texture.setFilter(scale === 8 ? 0 : 1);
        }
        const shadow = scene.add.image(POINTS.hidden[0], POINTS.hidden[1], 'santa_shadow_classic_peek').setDepth(-9).setVisible(false);
        const contacts = [0, 1].map(() => scene.add.image(0, 0, 'santa_sole_contact_1').setDepth(-8.2).setVisible(false));
        const magic = createMagic(scene);
        let frame = 'peek', destroyed = false;
        function render(state) {
            if (destroyed) return;
            if (state.frame !== frame) {
                frame = state.frame; artwork.apply(sprite, 'santa_' + frame);
            }
            const spec = specs.get(frame);
            const style = artwork.mode === 'high-resolution' ? 'hd' : 'classic';
            const version = spec.versions[style], placement = version.placement;
            sprite.setFlipX(state.flipX).setOrigin(state.flipX ? 1 - spec.reg[0] / spec.w : spec.reg[0] / spec.w, spec.reg[1] / spec.h);
            sprite.setPosition(state.x, state.y - placement.groundOffset).setDepth(state.behindGrove ? -8 : -6).setVisible(state.visible);
            const projected = state.flipX ? version.shadowFlipped : version.shadow;
            shadow.setTexture(projected.key).setDisplaySize(projected.w, projected.h)
                .setOrigin(projected.reg[0] / projected.w, projected.reg[1] / projected.h);
            shadow.texture.setFilter(style === 'hd' ? 0 : 1);
            shadow.setPosition(state.x, state.y).setVisible(state.visible);
            contacts.forEach((contact, i) => {
                const point = placement.contactPoints[i];
                contact.setVisible(state.visible && !state.airborne && !!point);
                if (!point) return;
                contact.setTexture('santa_sole_contact_' + (style === 'hd' ? 8 : 1))
                    .setDisplaySize(Math.max(2.5, point.width + 0.4), 1.4)
                    .setPosition(state.x + (state.flipX ? -point.x : point.x), state.y - placement.groundOffset + point.y + 0.15);
            });
            magic.render(state, style === 'hd');
        }
        function destroy() {
            if (destroyed) return;
            destroyed = true; sprite.destroy(); shadow.destroy(); grove.destroy(); contacts.forEach(contact => contact.destroy()); magic.destroy();
            scene.events.off('shutdown', destroy);
        }
        scene.events.once('shutdown', destroy);
        return { update: ms => render(visit.advance(ms)), startVisit: () => render(visit.start()),
            snapshot: () => ({ ...visit.snapshot(), artwork: artwork.mode, magic: magic.snapshot() }), destroy, sprite, grove, shadow, contacts, magic };
    }
    return { FRAMES, RUN_CYCLE, WAVE_CYCLE, NOSE_CYCLE, canFlip, TIMING, POINTS, Visit, create };
});
