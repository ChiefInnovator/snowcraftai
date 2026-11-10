/* HD presentation only. Director coordinates, clocks, mattes and RNG belong
 * to game.js; none of the interpolation below writes to gameplay state. */
(function (root, factory) {
    const api = factory(root);
    root.SnowcraftMotion = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const clamp = n => Math.max(0, Math.min(1, n));
    const lerp = (a, b, f) => a + (b - a) * f;
    const ROLES = ['gather', 'cock', 'release', 'follow', 'recoil', 'fall', 'kneel', 'rise', 'ready', 'blink', 'shift', 'settle'];
    const IDS = ['R', 'G'].flatMap(t => [
        ...Array.from({ length: 8 }, (_, i) => t + '_walk_' + i),
        ...Array.from({ length: 8 }, (_, i) => t + '_strafe_' + i), ...ROLES.map(r => t + '_' + r)
    ]);

    function makePath(points, fps) {
        let end = 0;
        const distance = [0];
        for (let i = 1; i < points.length; i++) {
            const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            distance.push(distance[i - 1] + d);
            if (d) end = i;
        }
        return { points, fps, distance, end, duration: points.length * 1000 / fps };
    }
    function samplePath(path, elapsed) {
        const step = Math.max(0, elapsed * path.fps / 1000), i = Math.min(path.points.length - 1, Math.floor(step));
        const j = Math.min(i + 1, path.points.length - 1), a = path.points[i], b = path.points[j];
        // Brake over the last recorded segment without changing its endpoint/time.
        const f = j === path.end ? 1 - (1 - (step - i)) ** 2 : clamp(step - i);
        return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), distance: lerp(path.distance[i], path.distance[j], f),
            moving: step < path.end, settled: Math.max(0, elapsed - path.end * 1000 / path.fps) };
    }
    function gait(distance, seed = 0, reverse = false) {
        const n = Math.floor(distance / 3.5) + seed;
        return ((reverse ? -n : n) % 8 + 8) % 8;
    }
    function ballSample(b, fraction, bornFraction = 0) {
        const f = clamp((fraction - bornFraction) / Math.max(0.0001, 1 - bornFraction));
        const step = b.phase === 'fly' ? b.flyStep : b.phase === 'drop' ? b.dropStep : { x: 0, y: 0 };
        const heights = [32, 27, 20, 11, 0];
        const height = b.phase === 'fly' ? 35 : b.phase === 'drop' ? lerp(heights[b.frame], heights[b.frame + 1], f) : 0;
        return { x: b.gx + step.x * f, y: b.gy + step.y * f, height, fraction: f };
    }
    function registerRedInjury(frame, geometry, ready, foot, fall, dead) {
        // Historical hit/dead sprites use a different canvas, scale and anchor.
        // Fit the actual coat/boots area, then match the falling body's centre.
        const scale = Math.sqrt(ready.bodyArea / geometry.bodyArea), angle = (dead ? 40 : 10) * Math.PI / 180;
        const centre = [foot.x + fall.bodyCentre[0] * Math.cos(angle) - fall.bodyCentre[1] * Math.sin(angle),
            foot.y + fall.bodyCentre[0] * Math.sin(angle) + fall.bodyCentre[1] * Math.cos(angle)];
        const offset = centre.map((v, i) => v - geometry.bodyCentre[i] * scale);
        const shadow = frame.shadow && { ...frame.shadow, w: frame.shadow.w * scale, h: frame.shadow.h * scale,
            reg: frame.shadow.reg.map((v, i) => v * scale - offset[i]) };
        return { ...frame, w: frame.w * scale, h: frame.h * scale,
            reg: frame.reg.map((v, i) => v * scale - offset[i]), shadow, contactPoints: [],
            bodyArea: geometry.bodyArea * scale * scale, bodyCentre: centre, presentationScale: scale };
    }
    function preload(scene) {
        IDS.forEach(id => {
            scene.load.image('motion_' + id, 'assets/hd/motion/' + id + '.png');
            scene.load.image('hd_shadow_motion_' + id, 'assets/hd/motion/shadow_' + id + '.png');
        });
        scene.load.json('hd_motion', 'assets/hd/motion/manifest.json');
    }

    function create(scene, artwork) {
        const manifest = scene.cache.json.get('hd_motion'), kids = new Map(), balls = new Map(), particles = [];
        let enabled = true, destroyed = false;
        const hd = () => enabled && artwork.mode === 'high-resolution';
        function texture(key, width, height, paint) {
            if (scene.textures.exists(key)) return;
            const t = scene.textures.createCanvas(key, width, height); paint(t.getContext(), width, height); t.refresh();
            t.setFilter(root.Phaser.Textures.FilterMode.LINEAR);
        }
        texture('motion_contact', 64, 24, (c, w, h) => {
            c.scale(w / 2, h / 2); c.translate(1, 1); const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
            g.addColorStop(0, 'rgba(28,51,70,.72)'); g.addColorStop(.45, 'rgba(42,64,82,.42)'); g.addColorStop(1, 'rgba(64,89,110,0)');
            c.fillStyle = g; c.fillRect(-1, -1, 2, 2);
        });
        texture('motion_snow', 32, 32, (c, w) => {
            const g = c.createRadialGradient(11, 9, 1, 16, 16, 15);
            g.addColorStop(0, '#fff'); g.addColorStop(.55, '#f5fbff'); g.addColorStop(.85, '#c6e0ed'); g.addColorStop(1, 'rgba(156,192,213,0)');
            c.fillStyle = g; c.beginPath(); c.arc(16, 16, 15, 0, Math.PI * 2); c.fill();
        });
        // Match the original 11px snowball canvas (10px opaque ball). A cool
        // outline keeps the white sphere readable against the white field.
        const ballSize = root.SnowcraftParity.CAST.snowball.w;
        texture('motion_ball', 48, 48, c => {
            const g = c.createRadialGradient(17, 14, 2, 24, 24, 22);
            g.addColorStop(0, '#fff'); g.addColorStop(.5, '#f4fbff');
            g.addColorStop(.82, '#c1dbe8'); g.addColorStop(1, '#90b3ca');
            c.fillStyle = g; c.strokeStyle = '#58778f'; c.lineWidth = 3;
            c.beginPath(); c.arc(24, 24, 21, 0, Math.PI * 2); c.fill(); c.stroke();
        });
        function addKid(kid, index) {
            const state = { kid, team: kid.teamType === 'player' ? 'R' : 'G', seed: (index * 3 + (kid.teamType === 'player' ? 0 : 1)) % 8,
                idle: index * 971 + (kid.teamType === 'player' ? 320 : 1700), distance: 0, x: kid.x, y: kid.y,
                image: scene.add.image(0, 0, 'motion_R_ready').setVisible(false),
                blend: scene.add.image(0, 0, 'motion_R_ready').setVisible(false),
                daze: scene.add.graphics().setVisible(false),
                contacts: [0, 1].map(() => scene.add.image(0, 0, 'motion_contact').setDepth(-4.9).setVisible(false)) };
            kid.add(state.blend); kid.add(state.daze); kid.add(state.image); kids.set(kid, state);
            kid.once('destroy', () => destroyKid(kid));
        }
        function destroyKid(kid) {
            const s = kids.get(kid); if (!s) return;
            s.contacts.forEach(i => i.destroy()); s.image.destroy(); s.blend.destroy(); s.daze.destroy(); kids.delete(kid);
        }
        function startWalk(kid, points, fps) {
            const s = kids.get(kid); if (s) { s.path = makePath(points, fps); s.walkStep = 0; }
        }
        function walkStep(kid, step) { const s = kids.get(kid); if (s) s.walkStep = step; }
        function stopWalk(kid) { const s = kids.get(kid); if (s) { s.path = null; s.move = null; s.x = kid.x; s.y = kid.y; } }
        function move(kid, from, kind, direction) {
            const s = kids.get(kid); if (!s) return;
            const startDistance = s.move ? s.move.toDistance : s.distance;
            s.move = { x: s.x, y: s.y, toX: kid.x, toY: kid.y, at: scene.time.now, kind, reverse: direction.x < 0,
                fromDistance: startDistance, toDistance: startDistance + Math.hypot(kid.x - from.x, kid.y - from.y) };
        }
        function action(kid, name, extra) {
            const s = kids.get(kid); if (s) {
                s.action = { name, at: scene.time.now, ...extra }; s.path = null;
                if (['hit', 'down', 'dead', 'recover'].includes(name)) s.move = null;
            }
        }
        function legacy(s, name) {
            const spec = name ? root.SnowcraftParity.kidMember(name) : s.kid.memberSpec;
            const frame = { ...spec, key: root.SnowcraftArtwork.characterTextureKey(spec.key), shadow: scene.hdShadowSpecs[spec.key],
                contactPoints: manifest.legacy[spec.key]?.contactPoints || [], legacy: true };
            if (s.team === 'R' && ['R hit', 'R hit2', 'R dead'].includes(spec.name)) {
                return registerRedInjury(frame, manifest.legacy[spec.key], manifest.frames.R_ready, manifest.teams.R.foot,
                    manifest.frames.R_fall, spec.name === 'R dead');
            }
            return frame;
        }
        function pose(s, role) { return manifest.frames[s.team + '_' + role]; }
        function choose(s, now, moving, settled) {
            const k = s.kid, a = s.action, elapsed = a ? now - a.at : 0;
            if (a) {
                if (a.name === 'charge' && (k === scene.activePlayer || k.ai === 'throw')) return pose(s, elapsed < (a.gather || 240) ? 'gather' : 'cock');
                if (a.name === 'release' && elapsed < 360) return pose(s, elapsed < 80 ? 'release' : elapsed < 300 ? 'follow' : 'settle');
                if (['hit', 'down', 'dead'].includes(a.name)) {
                    if (elapsed < 85) return pose(s, 'recoil');
                    if (elapsed < 210) return pose(s, 'fall');
                    if (a.name === 'dead') return legacy(s);
                    if (a.name === 'down' && k.isImmune) return legacy(s, 'G down');
                    if (elapsed < 310) return legacy(s, s.team === 'R' ? 'R hit' : 'G down');
                    if (elapsed < 440) return pose(s, 'kneel');
                    if (elapsed < 580) return pose(s, 'rise');
                }
                if (a.name === 'recover' && elapsed < 400) return pose(s, elapsed < 170 ? 'kneel' : elapsed < 330 ? 'rise' : 'settle');
            }
            if (k.isDazed) return pose(s, 'ready');
            if (k.ai === 'hurt') return legacy(s);
            if (moving) {
                const phase = gait(s.distance, s.seed, !!s.move?.reverse);
                if (phase !== s.phase && [0, 4].includes(phase) && hd()) scene.stepSound();
                s.phase = phase;
                return pose(s, (s.move?.kind === 'side' ? 'strafe_' : 'walk_') + phase);
            }
            if (settled < 220) return pose(s, 'settle');
            if (!k.isAlive || !['R ready', 'R rest', 'G ready'].includes(k.memberName)) return legacy(s);
            const t = now + s.idle, blink = t % (4300 + s.seed * 173), shift = t % (7900 + s.seed * 97);
            return pose(s, blink < 115 ? 'blink' : shift < 380 ? 'shift' : 'ready');
        }
        function apply(image, frame) {
            if (image.texture.key !== frame.key) image.setTexture(frame.key);
            image.setDisplaySize(frame.w, frame.h).setOrigin(frame.reg[0] / frame.w, frame.reg[1] / frame.h);
        }
        function drawKid(s, now) {
            const k = s.kid;
            if (!hd()) {
                s.x = k.x; s.y = k.y;
                if (s.move) s.distance = s.move.toDistance;
                k.bodySprite.setVisible(true); s.image.setVisible(false); s.blend.setVisible(false); s.daze.setVisible(false); s.contacts.forEach(i => i.setVisible(false));
                return;
            }
            let moving = false, settled = Infinity;
            if (s.path && k.isWalkingOntoField) {
                // Timer progress shares the authoritative path clock. Scene.now
                // can predate a pointer-created timer by a frame or more.
                const progress = clamp((k.walkTimer?.elapsed || 0) / (1000 / s.path.fps));
                const p = samplePath(s.path, (s.walkStep + progress) * 1000 / s.path.fps);
                s.x = p.x; s.y = p.y; s.distance = p.distance; moving = p.moving; settled = p.settled;
            } else if (s.move && k.isAlive) {
                const f = clamp((now - s.move.at) / 100);
                s.x = lerp(s.move.x, s.move.toX, f); s.y = lerp(s.move.y, s.move.toY, f);
                s.distance = lerp(s.move.fromDistance, s.move.toDistance, f);
                moving = f < 1; settled = now - s.move.at - 100;
                if (f === 1) { s.x = k.x; s.y = k.y; }
            } else { s.x = k.x; s.y = k.y; }
            // Dragged children stay exactly under the pointer, including touch lift.
            if (k === scene.activePlayer) { s.x = k.x; s.y = k.y; s.move = null; }
            const frame = choose(s, now, moving, settled), foot = frame.legacy ? { x: 0, y: 0 } : manifest.teams[s.team].foot;
            const x = s.x - k.x + foot.x, y = s.y - k.y + foot.y - (frame.groundOffset || 0);
            const idle = !moving && !k.isDazed && frame.group === 'actions' && ['ready', 'blink', 'shift'].some(n => frame.id.endsWith('_' + n));
            const breath = idle ? Math.sin((now + s.idle) / 620) * .004 : 0;
            // Only almost-identical idle poses dissolve. Action silhouettes
            // remain solid; a fall rotates continuously between its key poses.
            if (s.frame && s.frame.key !== frame.key) {
                s.previous = s.frame; s.changedAt = now;
                const idlePose = f => f.id && ['ready', 'blink', 'shift'].some(n => f.id.endsWith('_' + n));
                s.crossfade = !moving && idlePose(s.frame) && idlePose(frame);
            }
            s.frame = frame; const mix = s.crossfade ? clamp((now - s.changedAt) / 55) : 1;
            apply(s.image, frame); s.image.setPosition(x, y).setVisible(true).setAlpha(mix);
            s.image.scaleY *= 1 + breath;
            // Breathing scales around the ground anchor rather than lifting boots.
            s.image.y -= (frame.groundOffset || 0) * breath;
            const actionElapsed = s.action ? now - s.action.at : 0, backward = s.team === 'R' ? 1 : -1;
            let angle = k.isDazed && frame.id === 'R_ready' ? Math.sin((now + s.idle) / 420) * 1.6 : 0;
            if (frame.id?.endsWith('_recoil')) angle = backward * 3 * clamp(actionElapsed / 85);
            if (frame.id?.endsWith('_fall')) angle = backward * (s.action?.name === 'dead' ? 40 : 10) * clamp((actionElapsed - 85) / 125);
            s.image.setAngle(angle);
            s.daze.clear().setVisible(k.isAlive && k.isDazed && actionElapsed >= 580);
            if (s.daze.visible) {
                // Both boots stay planted; three small orbiting stars signal
                // the stun without swapping in the oversized one-foot pose.
                for (let i = 0; i < 3; i++) {
                    const a = now / 400 + i * Math.PI * 2 / 3, dx = x + Math.cos(a) * 6, dy = y - 36.5 + Math.sin(a) * 1.8;
                    s.daze.fillStyle(0x64849b, .85).fillRect(dx - 1, dy - .3, 2, .6).fillRect(dx - .3, dy - 1, .6, 2);
                    s.daze.fillStyle(0xf6fbff, 1).fillCircle(dx, dy, .35);
                }
            }
            if (mix < 1 && s.previous) {
                const prev = s.previous, pf = prev.legacy ? { x: 0, y: 0 } : manifest.teams[s.team].foot;
                apply(s.blend, prev); s.blend.setPosition(s.x - k.x + pf.x, s.y - k.y + pf.y - (prev.groundOffset || 0)).setAlpha(1 - mix).setVisible(true);
            } else s.blend.setVisible(false);
            k.bodySprite.setVisible(false); k.shadow.setVisible(false);
            const shadow = frame.shadow;
            k.hdShadow.setVisible(!!shadow);
            if (shadow) {
                apply(k.hdShadow, shadow); k.hdShadow.setPosition(k.x + x, k.y + y + (frame.legacy ? 0 : frame.groundOffset)).setAlpha(k.alpha);
            }
            s.contacts.forEach((i, n) => {
                const c = frame.contactPoints[n]; i.setVisible(!!c && !frame.noContact && k.alpha > 0);
                if (c) {
                    const theta = angle * Math.PI / 180, cy = c.y * (1 + breath);
                    i.setPosition(k.x + s.image.x + c.x * Math.cos(theta) - cy * Math.sin(theta),
                        k.y + s.image.y + c.x * Math.sin(theta) + cy * Math.cos(theta) + .1)
                        .setDisplaySize(c.width + .65, 1.65).setAlpha(k.alpha);
                }
            });
        }
        function addBall(b) {
            const team = b.team === 'player' ? 'R' : 'G', frame = manifest.frames[team + '_release'];
            const hand = frame.releasePoint, foot = manifest.teams[team].foot;
            balls.set(b, { image: scene.add.image(b.gx, b.gy, 'motion_ball').setDepth(60).setDisplaySize(ballSize, ballSize),
                shadow: scene.add.image(b.gx, b.gy, 'motion_contact').setDepth(-4).setDisplaySize(6, 2), bornFraction: scene.ballClock / 50,
                release: hand ? { x: hand.x + foot.x, y: hand.y + foot.y - frame.groundOffset + 35 } : null });
        }
        function ballTick(b) { const s = balls.get(b); if (s) { s.bornFraction = 0; s.release = null; } }
        function burst(x, y, count = 6) {
            if (!hd()) return;
            const limit = root.matchMedia?.('(pointer: coarse)').matches ? 16 : 40;
            for (let n = 0; n < count && particles.length < limit; n++) {
                const angle = n * Math.PI * 2 / count, speed = 8 + n % 3 * 3;
                particles.push({ image: scene.add.image(x, y, 'motion_snow').setDepth(61).setDisplaySize(1.7, 1.7),
                    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 9, at: scene.time.now });
            }
        }
        function land(b) { burst(b.gx, b.gy, 5); }
        function destroyBall(b) { const s = balls.get(b); if (s) { s.image.destroy(); s.shadow.destroy(); balls.delete(b); } }
        function drawBalls(now) {
            for (const [b, s] of balls) {
                b.ball.setVisible(!hd()); s.image.setVisible(hd()); s.shadow.setVisible(hd());
                if (!hd()) continue;
                const p = ballSample(b, scene.ballClock / 50, s.bornFraction);
                const releaseX = s.release ? s.release.x * (1 - p.fraction) : 0, releaseY = s.release ? s.release.y * (1 - p.fraction) : 0;
                s.x = p.x + releaseX; s.y = p.y + releaseY;
                s.image.setPosition(s.x, s.y - p.height); s.shadow.setPosition(s.x + p.height * .22, p.y);
                if (b.phase === 'fly' || b.phase === 'drop') {
                    s.image.setDisplaySize(ballSize, ballSize).setAlpha(1); s.shadow.setDisplaySize(7 + p.height * .07, 2.3).setAlpha(.42 - p.height * .004);
                } else {
                    const melt = b.phase === 'melt' ? (b.frame + p.fraction + 1) / 5 : p.fraction / 5;
                    s.image.setDisplaySize(8 + melt * 6, 2.5 - melt).setAlpha(1 - melt); s.shadow.setAlpha(.18 * (1 - melt));
                }
            }
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i], t = (now - p.at) / 1000;
                if (t >= .24) { p.image.destroy(); particles.splice(i, 1); continue; }
                p.image.setVisible(hd()).setPosition(p.x + p.vx * t, p.y + p.vy * t + 38 * t * t).setAlpha(1 - t / .24);
            }
        }
        function update() { if (!destroyed) { const now = scene.time.now; for (const s of kids.values()) drawKid(s, now); drawBalls(now); } }
        function refresh() { for (const k of kids.keys()) scene.updateKidShadow(k); update(); }
        function reset(kid) { const s = kids.get(kid); if (s) { s.action = null; s.path = null; s.move = null; s.crossfade = false; } }
        function clearEffects() { particles.splice(0).forEach(p => p.image.destroy()); }
        function destroy() { if (destroyed) return; destroyed = true; for (const k of [...kids.keys()]) destroyKid(k); for (const b of [...balls.keys()]) destroyBall(b); clearEffects(); }
        scene.events.once('shutdown', destroy);
        return { addKid, destroyKid, startWalk, walkStep, stopWalk, move, addBall, ballTick, destroyBall, land, burst, reset, update, refresh, clearEffects,
            charge: (k, gather) => action(k, 'charge', { gather }), release: k => action(k, 'release'),
            hit: (k, down) => { action(k, down ? 'down' : 'hit'); burst(k.x, k.y - 14); },
            recover: k => action(k, 'recover'), dead: k => { action(k, 'dead'); burst(k.x, k.y - 14); },
            setEnabled: value => { enabled = !!value; refresh(); },
            snapshot: () => ({ enabled, kids: [...kids.values()].map(s => ({ team: s.team, x: s.x, y: s.y, frame: s.frame?.id || s.frame?.key, phase: s.phase, contacts: s.contacts.filter(i => i.visible).length })),
                balls: [...balls.values()].map(s => ({ x: s.x, y: s.y })), particles: particles.length }) };
    }
    return { IDS, makePath, samplePath, gait, ballSample, registerRedInjury, preload, create };
});
