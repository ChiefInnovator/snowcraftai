import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Browser-only regression checks. The shipped site still has no build step.
// End-screen setups use the existing debug/scene helpers rather than playing
// through ten entire matches; pointer, keyboard, touch and audio are real.
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const errors = [];
const evidence = {};
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
let server, browser, baseURL, output;

before(async () => {
    output = process.env.SNOWCRAFT_BROWSER_OUTPUT || await mkdtemp(path.join(tmpdir(), "snowcraft-browser-"));
    await mkdir(output, { recursive: true });
    server = createServer(async (request, response) => {
        try {
            let file = path.resolve(root, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
            if (file !== root && !file.startsWith(root + path.sep)) {
                response.writeHead(403).end();
                return;
            }
            if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
            response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
            const stream = createReadStream(file);
            stream.on("error", () => response.destroy());
            stream.pipe(response);
        } catch {
            response.writeHead(404).end();
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    baseURL = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch({ headless: true });
    console.log("Browser screenshots and measurements: " + output);
}, { timeout: 30000 });

after(async () => {
    await browser?.close();
    if (server) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
    if (output) await writeFile(path.join(output, "measurements.json"), JSON.stringify({ evidence, errors }, null, 2));
});

async function open(t, name, options = {}, waitForFonts = true) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, ...options });
    let releaseFonts = () => {};
    t.after(async () => {
        releaseFonts();
        await context.close();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ test: name, type: "pageerror", message: error.stack }));
    page.on("console", message => {
        if (message.type() === "error") errors.push({ test: name, type: "console", message: message.text() });
    });
    if (!waitForFonts) {
        // Exercise fallback-font layout followed by the asynchronous font update.
        const held = new Promise(resolve => { releaseFonts = resolve; });
        await page.route("https://fonts.gstatic.com/**", async route => {
            await held;
            await route.continue();
        });
    }
    await page.goto(baseURL + "/?debug", { waitUntil: "domcontentloaded" });
    await ready(page, waitForFonts);
    return { page, context, releaseFonts };
}

async function ready(page, fonts = true) {
    await page.waitForFunction(() => window.SnowcraftGame?.getScene()?.scoreBanner?.node);
    if (fonts) await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
}

async function geometry(page) {
    return page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        return {
            canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
            viewportWidth: innerWidth,
            pageWidth: document.documentElement.scrollWidth,
            labels: [scene.scoreBanner, scene.subText, scene.greetingText, scene.scoreText, scene.playAgainButton]
                .filter(label => label.visible && label.alpha > 0.95)
                .map(label => ({
                    text: label.node.textContent, x: label.x, y: label.y,
                    originX: label.originX, originY: label.originY,
                    width: label.width, height: label.height,
                    rect: label.node.getBoundingClientRect().toJSON(),
                    pointerEvents: getComputedStyle(label.node).pointerEvents
                }))
        };
    });
}

function assertAnchors(layout) {
    for (const label of layout.labels) {
        assert.ok(label.width > 0 && label.height > 0, label.text + " has intrinsic dimensions");
        const actualX = label.rect.x + label.rect.width * label.originX;
        const actualY = label.rect.y + label.rect.height * label.originY;
        const expectedX = layout.canvas.x + label.x * layout.canvas.width / 592;
        const expectedY = layout.canvas.y + label.y * layout.canvas.height / 320;
        // Phaser rounds clientWidth/clientHeight; tolerate subpixel font metrics.
        assert.ok(Math.abs(actualX - expectedX) < 2, label.text + " horizontal origin error: " + (actualX - expectedX));
        assert.ok(Math.abs(actualY - expectedY) < 2, label.text + " vertical origin error: " + (actualY - expectedY));
    }
}

async function screenshot(page, name) {
    // Canvas-only screenshots omit the browser-rendered game text.
    await page.screenshot({ path: path.join(output, name + ".png") });
}

async function start(page, touch = false) {
    const title = await page.locator(".game-text").filter({ hasText: /^SnowCraft$/ }).boundingBox();
    assert.ok(title, "title is rendered");
    // Click the text's SCREEN position, so pointer interception is exercised.
    if (touch) await page.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
    else await page.mouse.click(title.x + title.width / 2, title.y + title.height / 2);
    await page.waitForFunction(() => !SnowcraftGame.getScene().awaitingTitleClick);
}

async function active(page) {
    await page.waitForFunction(() => SnowcraftGame.getScene().isLevelActive, null, { timeout: 15000 });
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.stopAI();
        scene.greenTeam.forEach(kid => scene.cancelActions(kid));
    });
}

async function replay(page, method) {
    await page.waitForFunction(() => {
        const button = SnowcraftGame.getScene().playAgainButton;
        return button.visible && button.alpha > 0.95;
    }, null, { timeout: 15000 });
    const layout = await geometry(page);
    assertAnchors(layout);
    const buttonLayout = layout.labels.find(label => label.text === "Play Again");
    assert.ok(buttonLayout, "replay is visible");
    assert.ok(buttonLayout.rect.right < layout.canvas.right && buttonLayout.rect.bottom < layout.canvas.bottom, "replay stays inset within the stage");
    const button = page.locator("button.replay-button");
    if (method === "keyboard") {
        await button.focus();
        await page.keyboard.press("Enter");
    } else if (method === "touch") await button.tap();
    else await button.click();
    await page.waitForFunction(() => {
        const scene = SnowcraftGame.getScene();
        return scene.currentLevelIndex === 0 && scene.score === 0 && !scene.awaitingTitleClick && !scene.playAgainButton.visible && scene.redTeam.length === 3;
    });
    return layout;
}

async function audioState(page) {
    return page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        return {
            state: scene.audio.getState(), musicPlaying: scene.music.isPlaying,
            playing: scene.sound.getAllPlaying().map(sound => sound.key),
            musicChecked: document.getElementById("music-checkbox").checked,
            muteChecked: document.getElementById("mute-checkbox").checked
        };
    });
}

test("DOM text stays centered before/after fonts, resize and hide/show; title text does not intercept clicks", { timeout: 30000 }, async t => {
    const { page, releaseFonts } = await open(t, "font layout", {}, false);
    const before = await geometry(page);
    assertAnchors(before);
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const afterFonts = await geometry(page);
    assertAnchors(afterFonts);
    assert.equal(afterFonts.labels.find(label => label.text === "SnowCraft").pointerEvents, "none");
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForTimeout(750);
    assertAnchors(await geometry(page));
    await screenshot(page, "title-fonts-resize");
    await start(page);
    await active(page);
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.score = 123;
        scene.showLossScreen();
    });
    const end = await replay(page, "mouse");
    assert.ok(end.labels.some(label => label.text === "Happy Holidays"));
    evidence.fontLayout = { before, afterFonts, end };
});

test("all level banners use aligned browser text in original and high-resolution modes", { timeout: 30000 }, async t => {
    const { page } = await open(t, "level banners");
    const banners = [];
    for (const mode of ["original", "high-resolution"]) {
        await page.locator("#artwork-select").selectOption(mode);
        for (let level = 2; level <= 10; level++) {
            const observation = await page.evaluate(async level => {
                const scene = SnowcraftGame.getScene();
                scene.jumpToLevel(level - 1);
                scene.scoreBanner.setAlpha(1);
                // Observe real DOM transforms after rendering, using one browser
                // round trip per level rather than several polling round trips.
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const label = scene.scoreBanner;
                return {
                    state: { level: scene.currentLevelIndex + 1, text: label.node.textContent, mode: scene.artwork.mode },
                    layout: {
                        canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
                        labels: [{
                            text: label.node.textContent, x: label.x, y: label.y,
                            originX: label.originX, originY: label.originY,
                            width: label.width, height: label.height,
                            rect: label.node.getBoundingClientRect().toJSON()
                        }]
                    }
                };
            }, level);
            const { state, layout } = observation;
            assert.equal(state.text, level === 10 ? "Bonus Round" : "Level " + level);
            assert.equal(state.level, level);
            assert.equal(state.mode, mode);
            banners.push(state);
            assertAnchors(layout);
            if (level === 10) await screenshot(page, "bonus-round-" + mode);
        }
    }
    evidence.banners = banners;
});

test("real drag charges and throws; live artwork switching preserves score, pose and original collision matte", { timeout: 30000 }, async t => {
    const { page } = await open(t, "drag and artwork");
    await start(page);
    await active(page);
    const canvas = await page.locator("canvas").boundingBox();
    const kid = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.score = 17;
        return { x: scene.redTeam[0].x, y: scene.redTeam[0].y };
    });
    const x = canvas.x + kid.x * canvas.width / 592;
    const y = canvas.y + (kid.y - 14) * canvas.height / 320;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForFunction(() => SnowcraftGame.getScene().activePower >= 5);
    await page.mouse.move(x + 20 * canvas.width / 592, y + 18 * canvas.height / 320, { steps: 4 });
    const pose = async () => page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), kid = scene.activePlayer;
        const matte = scene.matteFor(kid.memberSpec.key);
        return {
            level: scene.currentLevelIndex, score: scene.score, dragging: scene.isDragging, power: scene.activePower,
            kid: { x: kid.x, y: kid.y, width: kid.bodySprite.displayWidth, height: kid.bodySprite.displayHeight, originX: kid.bodySprite.originX, originY: kid.bodySprite.originY, source: kid.memberSpec.key },
            backing: { width: kid.bodySprite.width, height: kid.bodySprite.height },
            shadow: { x: kid.shadow.x, y: kid.shadow.y },
            matte: { width: matte.w, height: matte.h, bits: Array.from(matte.bits) }
        };
    });
    const original = await pose();
    assert.equal(original.dragging, true);
    assert.ok(original.power > 0);
    await page.locator("#artwork-select").selectOption("high-resolution");
    const high = await pose();
    assert.deepEqual(high.kid, original.kid);
    assert.deepEqual(high.matte, original.matte);
    assert.equal(high.score, 17);
    assert.equal(high.level, original.level);
    assert.equal(high.dragging, true);
    assert.equal(high.backing.width, high.kid.width * 8);
    assert.equal(high.backing.height, high.kid.height * 8);
    assert.equal(high.shadow.x, high.kid.x);
    assert.equal(high.shadow.y, high.kid.y);
    await screenshot(page, "drag-high-resolution");
    await page.locator("#artwork-select").selectOption("original");
    const reverted = await pose();
    assert.deepEqual(reverted.kid, original.kid);
    assert.equal(reverted.backing.width, original.backing.width);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().isDragging), false);
    assert.ok(await page.evaluate(() => SnowcraftGame.getScene().projectiles.length > 0));
    delete original.matte.bits;
    delete high.matte.bits;
    evidence.artwork = { original, high };
});

test("all 35 HD poses retain logical geometry and one selection ring across artwork changes", { timeout: 30000 }, async t => {
    const { page } = await open(t, "HD frames and rings");
    await start(page);
    // A stalled browser frame can make Clock dispatch a looping walk-on event
    // repeatedly after completion. Count down each kid exactly once.
    const completedWalkOn = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.time.preUpdate();
        scene.time.update(scene.time.now + 10000, 10000);
        return { count: scene.walkingCount, walking: [...scene.redTeam, ...scene.greenTeam].filter(kid => kid.isWalkingOntoField).length };
    });
    assert.deepEqual(completedWalkOn, { count: 0, walking: 0 });
    await active(page);
    const observations = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        const specs = SnowcraftParity.CAST.kids.filter(spec => spec.name !== 'shadow');
        const probes = specs.map(spec => {
            const image = scene.add.image(0, 0, spec.key).setVisible(false);
            SnowcraftParity.applyOrigin(image, spec);
            scene.artwork.apply(image, spec.key);
            return { spec, image };
        });
        const modes = [];
        for (const mode of ['original', 'high-resolution', 'original']) {
            scene.artwork.setMode(mode);
            modes.push({ mode, frames: probes.map(({ spec, image }) => ({
                key: spec.key, expectedWidth: spec.w, expectedHeight: spec.h,
                width: image.displayWidth, height: image.displayHeight,
                origin: [image.originX, image.originY], expectedOrigin: [spec.reg[0] / spec.w, spec.reg[1] / spec.h],
                texture: image.texture.key, backing: [image.width, image.height],
                matte: [scene.matteFor(spec.key).w, scene.matteFor(spec.key).h]
            })) });
        }
        probes.forEach(({ image }) => image.destroy());
        const kid = scene.redTeam[0], rings = [];
        for (const mode of ['original', 'high-resolution', 'original']) {
            scene.artwork.setMode(mode);
            for (const pose of ['R ready', 'R pop', 'R cock', 'R toss']) {
                scene.setKidMember(kid, pose);
                scene.updateSelectionUI(kid);
                rings.push({ mode, pose, original: scene.selectionCircle.visible, hd: scene.hdSelectionCircle.visible });
            }
        }
        scene.hideSelectionUI();
        scene.setKidMember(kid, 'R ready');
        scene.artwork.setMode('high-resolution');
        scene.setKidMember(scene.redTeam[1], 'R hit');
        scene.setKidMember(scene.redTeam[2], 'R dead', 2);
        scene.setKidMember(scene.greenTeam[0], 'G down');
        scene.setKidMember(scene.greenTeam[1], 'G dead', 2);
        return { modes, rings };
    });
    assert.equal(observations.modes[0].frames.length, 35);
    for (const { mode, frames } of observations.modes) {
        for (const frame of frames) {
            assert.equal(frame.width, frame.expectedWidth, frame.key);
            assert.equal(frame.height, frame.expectedHeight, frame.key);
            assert.deepEqual(frame.origin, frame.expectedOrigin, frame.key);
            assert.deepEqual(frame.matte, [frame.expectedWidth, frame.expectedHeight], frame.key);
            const scale = mode === 'high-resolution' ? 8 : 1;
            assert.deepEqual(frame.backing, [frame.expectedWidth * scale, frame.expectedHeight * scale], frame.key);
            assert.equal(frame.texture, mode === 'high-resolution' ? frame.key + '__snowcraft_redrawn8x' : frame.key);
        }
    }
    for (const ring of observations.rings) {
        const embedded = ring.mode === 'original' && ring.pose !== 'R ready';
        assert.equal(Number(ring.original) + Number(ring.hd) + Number(embedded), 1, JSON.stringify(ring));
        assert.equal(ring.hd, ring.mode === 'high-resolution');
    }
    await page.locator("#artwork-select").selectOption("high-resolution");
    await screenshot(page, "hd-hit-down-dead-poses");
    evidence.hdCharacters = observations;
});

test("victory animates Congratulations then aligned greeting/replay; mouse replay resets level and score", { timeout: 30000 }, async t => {
    const { page } = await open(t, "victory replay");
    await start(page);
    await active(page);
    const observed = await page.evaluate(async () => {
        const scene = SnowcraftGame.getScene();
        scene.isLevelActive = false;
        scene.hideEndScreen();
        scene.score = 123;
        scene.showVictoryScreen();
        // Observe the actual full-opacity frame. A fixed sleep can miss the
        // short hold when browser scheduling is delayed on a busy CI runner.
        const deadline = performance.now() + 7000;
        while (scene.scoreBanner.alpha < 0.99 && performance.now() < deadline) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        const label = scene.scoreBanner;
        return {
            fullyVisible: label.visible && label.alpha >= 0.99,
            replayVisible: scene.playAgainButton.visible,
            layout: {
                canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
                labels: [{
                    text: label.node.textContent, x: label.x, y: label.y,
                    originX: label.originX, originY: label.originY,
                    width: label.width, height: label.height,
                    rect: label.node.getBoundingClientRect().toJSON()
                }]
            }
        };
    });
    assert.equal(observed.fullyVisible, true);
    assert.equal(observed.replayVisible, false);
    const congrats = observed.layout;
    assert.ok(congrats.labels.some(label => label.text === "Congratulations!"));
    assertAnchors(congrats);
    await screenshot(page, "congratulations");
    const end = await replay(page, "mouse");
    assert.ok(end.labels.some(label => label.text === "Happy Holidays"));
    evidence.victory = { congrats, end };
});

test("loss score and queued audio reveal inset replay; keyboard activation resets the game", { timeout: 30000 }, async t => {
    const { page } = await open(t, "keyboard replay");
    await start(page);
    await active(page);
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.isLevelActive = false;
        scene.hideEndScreen();
        scene.currentLevelIndex = 2;
        scene.score = 20;
        scene.killsThisLevel = 2;
        scene.levelLost();
    });
    await page.waitForFunction(() => SnowcraftGame.getScene().playAgainButton.visible, null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const end = await geometry(page);
    assert.ok(end.labels.some(label => label.text === "SCORE: 66"));
    assertAnchors(end);
    await screenshot(page, "loss-score-replay");
    await replay(page, "keyboard");
    evidence.loss = end;
});

test("music and mute-all control actual playback independently and persist across rebuild/reload", { timeout: 45000 }, async t => {
    const { page } = await open(t, "audio preferences");
    const pendingUnlock = [];
    for (const gate of ["enabled", "music-off", "mute-all"]) {
        await page.locator("#music-checkbox").setChecked(gate !== "music-off");
        await page.locator("#mute-checkbox").setChecked(gate === "mute-all");
        const pending = await page.evaluate(() => {
            const scene = SnowcraftGame.getScene();
            scene.audio.startMusic();
            // Keep the real pointer unlock hook, while suppressing startLevel's
            // second startMusic call: that call would mask a broken unlock().
            scene.awaitingTitleClick = false;
            return { state: scene.audio.getState(), playing: scene.music.isPlaying };
        });
        assert.equal(pending.state.unlocked, false);
        assert.equal(pending.state.musicWanted, true);
        assert.equal(pending.playing, false);
        await start(page);
        await page.waitForFunction(() => SnowcraftGame.getScene().audio.isUnlocked());
        const unlocked = await audioState(page);
        assert.equal(unlocked.musicPlaying, gate === "enabled", gate + " pending music after real gesture");
        assert.equal(await page.evaluate(() => SnowcraftGame.getScene().redTeam.length), 0, "level start did not mask pending playback");
        pendingUnlock.push({ gate, pending, unlocked });
        await page.reload({ waitUntil: "domcontentloaded" });
        await ready(page);
    }
    await page.locator("#music-checkbox").check();
    await page.locator("#mute-checkbox").uncheck();
    await start(page);
    await active(page);
    const states = { pendingUnlock, start: await audioState(page) };
    assert.equal(states.start.musicPlaying, true);
    await page.locator("#music-checkbox").uncheck();
    states.musicOff = await audioState(page);
    assert.equal(states.musicOff.musicPlaying, false);
    assert.equal(states.musicOff.state.musicEnabled, false);
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().audio.play("laugh", "browser-test")), true);
    assert.ok((await audioState(page)).playing.includes("sfx_laugh"));
    await page.locator("#mute-checkbox").check();
    assert.deepEqual((await audioState(page)).playing, []);
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().audio.play("laugh", "browser-test")), false);
    await page.locator("#music-checkbox").check();
    assert.equal((await audioState(page)).musicPlaying, false);
    await page.locator("#mute-checkbox").uncheck();
    assert.equal((await audioState(page)).musicPlaying, true);
    await page.locator("#music-checkbox").uncheck();
    await page.locator("#mute-checkbox").check();
    await page.locator("#scale-select").selectOption("1.5");
    await ready(page);
    states.rebuild = await audioState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    states.reload = await audioState(page);
    for (const state of [states.rebuild, states.reload]) {
        assert.equal(state.state.musicEnabled, false);
        assert.equal(state.state.muted, true);
        assert.equal(state.musicChecked, false);
        assert.equal(state.muteChecked, true);
        assert.equal(state.musicPlaying, false);
    }
    evidence.audio = states;
});

test("desktop scales, HiDPI and fullscreen keep browser text anchored within the game", { timeout: 30000 }, async t => {
    const { page } = await open(t, "desktop scaling");
    const scales = [];
    await page.locator("#artwork-select").selectOption("high-resolution");
    for (const scale of ["1", "1.5", "2", "3"]) {
        await page.locator("#scale-select").selectOption(scale);
        await ready(page);
        const layout = await geometry(page);
        assertAnchors(layout);
        assert.ok(layout.pageWidth <= layout.viewportWidth);
        assert.equal(await page.locator("#artwork-select").inputValue(), "high-resolution");
        scales.push({ scale, layout });
    }
    await page.locator("#fullscreen-btn").click();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => isFullscreen()), true);
    assertAnchors(await geometry(page));
    await screenshot(page, "desktop-fullscreen");
    await page.locator("#fullscreen-btn").click();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => isFullscreen()), false);
    assertAnchors(await geometry(page));
    const hidpi = await open(t, "HiDPI", { deviceScaleFactor: 2 });
    const highDensity = await geometry(hidpi.page);
    assertAnchors(highDensity);
    await screenshot(hidpi.page, "desktop-hidpi");
    evidence.scales = { scales, highDensity };
});

test("phone rotates back to portrait after fullscreen, actual touch drag/throw and touch replay", { timeout: 35000 }, async t => {
    const { page, context } = await open(t, "phone touch", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.locator("#artwork-select").selectOption("high-resolution");
    const portrait = await geometry(page);
    assertAnchors(portrait);
    assert.ok(portrait.pageWidth <= 390);
    assert.equal(await page.locator("#rotate-hint").isVisible(), true);
    await screenshot(page, "phone-portrait");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(850);
    const landscape = await geometry(page);
    assertAnchors(landscape);
    assert.ok(landscape.pageWidth <= 844);
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
    await screenshot(page, "phone-landscape");
    await page.locator("#fullscreen-btn").click();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => isFullscreen()), true);
    await page.locator("#fullscreen-btn").click();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => isFullscreen()), false);
    await start(page, true);
    await active(page);
    const canvas = await page.locator("canvas").boundingBox();
    const kid = await page.evaluate(() => ({ x: SnowcraftGame.getScene().redTeam[0].x, y: SnowcraftGame.getScene().redTeam[0].y }));
    const x = canvas.x + kid.x * canvas.width / 592;
    const y = canvas.y + (kid.y - 14) * canvas.height / 320;
    const touch = await context.newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().isDragging), true);
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 15, y: y + 15, id: 1 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.ok(await page.evaluate(() => SnowcraftGame.getScene().projectiles.length > 0));
    await page.waitForFunction(() => !SnowcraftGame.getScene().lastThrownPlayer);
    assert.deepEqual(await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        return { dragging: scene.isDragging, hover: !!scene.hoveredPlayer, original: scene.selectionCircle.visible, hd: scene.hdSelectionCircle.visible };
    }), { dragging: false, hover: false, original: false, hd: false });
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.stopAI();
        scene.isLevelActive = false;
        scene.score = 23;
        scene.showLossScreen();
    });
    await replay(page, "touch");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(850);
    const returned = await geometry(page);
    assertAnchors(returned);
    assert.ok(returned.pageWidth <= 390);
    assert.equal(await page.locator("#rotate-hint").isVisible(), true);
    await screenshot(page, "phone-return-portrait");
    evidence.phone = { portrait, landscape, returned };
});

test("browser matrix produces no uncaught page errors or console errors", () => {
    assert.deepEqual(errors, []);
});
