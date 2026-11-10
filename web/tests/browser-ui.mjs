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
// GitHub's runners render this suite several times slower than a desktop.
// Scale every time limit there instead of tuning tests one by one.
const SLOW = process.env.CI ? 4 : 1;
// Phaser and the web fonts are fetched once per run, then replayed, so a slow
// CDN response cannot time out an individual test.
const thirdParty = new Map();
async function replayThirdParty(route) {
    const url = route.request().url();
    if (!thirdParty.has(url)) {
        thirdParty.set(url, route.fetch().then(async response => ({
            status: response.status(), headers: response.headers(), body: await response.body()
        })));
    }
    try {
        await route.fulfill(await thirdParty.get(url));
    } catch {
        thirdParty.delete(url);
        await route.continue();
    }
}

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
}, { timeout: 30000 * SLOW });

after(async () => {
    await browser?.close();
    if (server) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
    if (output) await writeFile(path.join(output, "measurements.json"), JSON.stringify({ evidence, errors }, null, 2));
});

async function open(t, name, options = {}, waitForFonts = true, { query = "/?debug", storage = {} } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, ...options });
    context.setDefaultTimeout(30000 * SLOW);
    for (const host of ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"]) {
        await context.route("https://" + host + "/**", replayThirdParty);
    }
    if (Object.keys(storage).length) {
        await context.addInitScript(values => {
            for (const key in values) if (localStorage.getItem(key) === null) localStorage.setItem(key, values[key]);
        }, storage);
    }
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
            await route.fallback();
        });
    }
    await page.goto(baseURL + query, { waitUntil: "domcontentloaded" });
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
    await page.waitForFunction(() => SnowcraftGame.getScene().isLevelActive, null, { timeout: 15000 * SLOW });
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
    }, null, { timeout: 15000 * SLOW });
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

test("DOM text stays centered before/after fonts, resize and hide/show; title text does not intercept clicks", { timeout: 30000 * SLOW }, async t => {
    const { page, releaseFonts } = await open(t, "font layout", {}, false);
    assert.equal(await page.locator('#artwork-select').inputValue(), 'high-resolution');
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().artwork.mode), 'high-resolution');
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

test("all level banners use aligned browser text in original and high-resolution modes", { timeout: 30000 * SLOW }, async t => {
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

test("real drag charges and throws; live artwork switching preserves score, pose and original collision matte", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "drag and artwork");
    await page.locator('#artwork-select').selectOption('original');
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
            sampling: getComputedStyle(document.querySelector('canvas')).imageRendering,
            matte: { width: matte.w, height: matte.h, bits: Array.from(matte.bits) }
        };
    });
    const original = await pose();
    assert.equal(original.dragging, true);
    assert.equal(original.sampling, 'pixelated');
    assert.ok(original.power > 0);
    await page.locator("#artwork-select").selectOption("high-resolution");
    const high = await pose();
    assert.equal(high.sampling, 'auto');
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
    assert.equal(reverted.sampling, 'pixelated');
    assert.deepEqual(reverted.kid, original.kid);
    assert.equal(reverted.backing.width, original.backing.width);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().isDragging), false);
    assert.ok(await page.evaluate(() => SnowcraftGame.getScene().projectiles.length > 0));
    delete original.matte.bits;
    delete high.matte.bits;
    evidence.artwork = { original, high };
});

test("all 35 HD poses retain logical geometry and one selection ring across artwork changes", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "HD frames and rings");
    // This fixture inspects the retained canonical pack. The live HD motion
    // layer has its own behavioral/visual checks below.
    await page.evaluate(() => SnowcraftGame.getScene().motion.setEnabled(false));
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

test("knockout hides standing shadows, revival restores them, and HD uses the redrawn snowfield", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "corrected artwork and shadows");
    await page.evaluate(() => SnowcraftGame.getScene().motion.setEnabled(false));
    await start(page);
    await active(page);
    const observations = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.stopAI();
        const kid = scene.redTeam[0];
        scene.handleHit(kid);
        const hitShadow = kid.shadow.visible;
        scene.handleHit(kid);
        const deadShadow = kid.shadow.visible;
        const groundKey = SnowcraftParity.CAST.ground.key;
        const ground = scene.children.list.find(image => image.snowcraftOriginalTextureKey === groundKey);
        const modes = [];
        for (const mode of ['high-resolution', 'original', 'high-resolution']) {
            scene.artwork.setMode(mode);
            modes.push({ mode, texture: ground.texture.key, width: ground.displayWidth, height: ground.displayHeight,
                backing: [ground.width, ground.height], deadShadow: kid.shadow.visible });
        }
        scene.reviveRed(kid);
        kid.setPosition(kid.x - 10, kid.y - 5);
        scene.update(0, 0);
        const revived = { alive: kid.isAlive, shadow: kid.hdShadow.visible, position: [kid.hdShadow.x, kid.hdShadow.y], expected: [kid.x, kid.y] };
        // Leave a real knockout and a recovering Green on screen for review.
        scene.knockOut(scene.redTeam[1], 'death_0');
        scene.setKidMember(scene.greenTeam[0], 'G down');
        const downShadow = scene.greenTeam[0].shadow.visible;
        scene.setKidMember(scene.greenTeam[0], 'G ready');
        const recoveredShadow = scene.greenTeam[0].hdShadow.visible;
        scene.setKidMember(scene.greenTeam[0], 'G down');
        return { hitShadow, deadShadow, revived, downShadow, recoveredShadow, modes, state: JSON.parse(render_game_to_text()) };
    });
    assert.equal(observations.hitShadow, false);
    assert.equal(observations.deadShadow, false);
    assert.equal(observations.downShadow, false);
    assert.equal(observations.recoveredShadow, true);
    assert.equal(observations.revived.alive, true);
    assert.equal(observations.revived.shadow, true);
    assert.deepEqual(observations.revived.position, observations.revived.expected);
    for (const sample of observations.modes) {
        const hd = sample.mode === 'high-resolution';
        assert.equal(sample.texture, 'cast_ground' + (hd ? '__snowcraft_redrawn4x' : ''));
        assert.deepEqual(sample.backing, hd ? [2400, 1280] : [600, 320]);
        assert.equal(sample.width, 600);
        assert.equal(sample.height, 320);
        assert.equal(sample.deadShadow, false);
    }
    await page.locator('#artwork-select').selectOption('high-resolution');
    await screenshot(page, 'corrected-falls-shadows-snowfield');
    evidence.artworkCorrections = observations;
});

test("HD pose shadows track movement, falls, fades and artwork switches", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, 'soft pose shadows');
    await page.evaluate(() => SnowcraftGame.getScene().motion.setEnabled(false));
    await start(page);
    await active(page);
    const observations = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), kid = scene.redTeam[0];
        const samples = [];
        for (const mode of ['original', 'high-resolution', 'original', 'high-resolution']) {
            scene.artwork.setMode(mode);
            for (const pose of ['R ready', 'R cock', 'R toss', 'R hit', 'R hit2', 'R dead']) {
                scene.setKidMember(kid, pose);
                kid.setPosition(kid.x - 1, kid.y - 1).setAlpha(0.6);
                scene.update(0, 0);
                const spec = scene.hdShadowSpecs[kid.memberSpec.key];
                samples.push({ mode, pose, original: kid.shadow.visible, hd: kid.hdShadow.visible,
                    texture: kid.hdShadow.texture.key, expectedKey: spec.key,
                    dimensions: [kid.hdShadow.displayWidth, kid.hdShadow.displayHeight], expectedDimensions: [spec.w, spec.h],
                    backing: [kid.hdShadow.width, kid.hdShadow.height],
                    origin: [kid.hdShadow.originX, kid.hdShadow.originY], expectedOrigin: [spec.reg[0] / spec.w, spec.reg[1] / spec.h],
                    position: [kid.hdShadow.x, kid.hdShadow.y], expectedPosition: [kid.x, kid.y], alpha: kid.hdShadow.alpha,
                    originalAlpha: kid.shadow.alpha, filter: kid.hdShadow.texture.source[0].scaleMode });
            }
        }
        scene.showKidIdle(kid); kid.setAlpha(1);
        scene.knockOut(scene.redTeam[1], 'death_0');
        scene.update(0, 0);
        return { samples, knockedOut: { original: scene.redTeam[1].shadow.visible, hd: scene.redTeam[1].hdShadow.visible,
            kind: scene.hdShadowSpecs[scene.redTeam[1].memberSpec.key].kind } };
    });
    for (const sample of observations.samples) {
        assert.equal(sample.hd, sample.mode === 'high-resolution');
        assert.equal(sample.original, sample.mode === 'original' && !['R hit', 'R hit2', 'R dead'].includes(sample.pose));
        assert.equal(sample.texture, sample.expectedKey);
        assert.deepEqual(sample.dimensions, sample.expectedDimensions);
        assert.deepEqual(sample.backing, sample.expectedDimensions.map(n => n * 8));
        assert.deepEqual(sample.origin, sample.expectedOrigin);
        assert.deepEqual(sample.position, sample.expectedPosition);
        assert.equal(sample.alpha, 0.6);
        assert.equal(sample.originalAlpha, 0.6);
        assert.equal(sample.filter, 0); // LINEAR sampling for reduced HD masks.
    }
    assert.deepEqual(observations.knockedOut, { original: false, hd: true, kind: 'grounded' });
    await page.locator('#artwork-select').selectOption('high-resolution');
    await screenshot(page, 'soft-pose-shadows');
    evidence.poseShadows = observations;
    // Exercise the documented debug revival after the actual loss fade,
    // including the separately tweened recovered Original shadow objects.
    await page.locator('#artwork-select').selectOption('original');
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.redTeam.filter(kid => kid.isAlive).forEach(kid => scene.knockOut(kid, 'death_0'));
    });
    await page.waitForFunction(() => SnowcraftGame.getScene().redTeam.every(kid => kid.alpha === 0 && kid.shadow.alpha === 0));
    await page.waitForTimeout(50);
    await page.keyboard.press('z');
    const revived = await page.evaluate(() => SnowcraftGame.getScene().redTeam.map(kid => ({
        alive: kid.isAlive, alpha: kid.alpha, shadow: kid.shadow.visible, shadowAlpha: kid.shadow.alpha, hd: kid.hdShadow.visible
    })));
    assert.ok(revived.every(kid => kid.alive && kid.alpha === 1 && kid.shadow && kid.shadowAlpha === 1 && !kid.hd));
    evidence.originalShadowRevival = revived;
});

test("Santa runs in, winks, waves, twitches his nose and magically vanishes in both artwork modes", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, 'Santa visit');
    await start(page);
    await active(page);
    await page.evaluate(() => {
        const santa = SnowcraftGame.getScene().santa;
        santa.advance = santa.update;
        santa.update = () => {}; // Own the cameo clock while RAF keeps rendering.
        santa.support = () => {
            const sprite = santa.sprite, image = sprite.texture.getSourceImage();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
            const sx = image.width / sprite.displayWidth, sy = image.height / sprite.displayHeight;
            return santa.contacts.filter(contact => contact.visible).map(contact => {
                let x = (contact.x - sprite.x + sprite.originX * sprite.displayWidth) * sx;
                if (sprite.flipX) x = image.width - 1 - x;
                const y = (contact.y - 0.15 - sprite.y + sprite.originY * sprite.displayHeight) * sy;
                let onSole = false;
                for (let py = Math.max(0, Math.floor(y - sy)); py <= Math.min(image.height - 1, Math.ceil(y)); py++) {
                    for (let px = Math.max(0, Math.floor(x - sx)); px <= Math.min(image.width - 1, Math.ceil(x + sx)); px++) {
                        const i = (py * image.width + px) * 4;
                        if (pixels[i + 3] >= 160 && pixels[i] < 110 && pixels[i + 1] < 110 && pixels[i + 2] < 110) onSole = true;
                    }
                }
                return { x: contact.x, y: contact.y, ground: santa.snapshot().y, height: contact.displayHeight, onSole };
            });
        };
        santa.overlap = (headOnly = false) => {
            const { sprite, grove } = santa;
            const actor = document.createElement('canvas'), trees = document.createElement('canvas');
            actor.width = trees.width = 592; actor.height = trees.height = 320;
            const a = actor.getContext('2d'), g = trees.getContext('2d');
            a.translate(sprite.x - sprite.originX * sprite.displayWidth, sprite.y - sprite.originY * sprite.displayHeight);
            if (headOnly) { a.beginPath(); a.rect(0, 0, sprite.displayWidth, sprite.displayHeight * 42 / 64); a.clip(); }
            if (sprite.flipX) { a.translate(sprite.displayWidth, 0); a.scale(-1, 1); }
            a.drawImage(sprite.texture.getSourceImage(), 0, 0, sprite.displayWidth, sprite.displayHeight);
            g.drawImage(grove.texture.getSourceImage(), grove.x, grove.y, grove.displayWidth, grove.displayHeight);
            const pixels = a.getImageData(0, 0, 592, 320).data, mask = g.getImageData(0, 0, 592, 320).data;
            let covered = 0, exposed = 0;
            for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) { if (mask[i] > 128) covered++; else exposed++; }
            return { covered, exposed, snowyBough: g.getImageData(484, 70, 1, 1).data[3] };
        };
    });
    const results = [];
    for (const mode of ['original', 'high-resolution']) {
        await page.locator('#artwork-select').selectOption(mode);
        const data = await page.evaluate(() => {
            const scene = SnowcraftGame.getScene(); scene.score = 17;
            const before = { score: scene.score, reds: scene.redTeam.map(k => k.hits), greens: scene.greenTeam.map(k => k.hits), balls: scene.projectiles.length };
            scene.santa.startVisit();
            const begin = { ...scene.santa.snapshot(), actorDepth: scene.santa.sprite.depth, groveDepth: scene.santa.grove.depth,
                interactive: !!scene.santa.sprite.input, occlusion: scene.santa.overlap() };
            scene.santa.advance(SnowcraftSanta.TIMING.entranceMs * 46 / 56);
            return { before, begin, entrance: { ...scene.santa.snapshot(), flipX: scene.santa.sprite.flipX,
                texture: scene.santa.sprite.texture.key, shadow: scene.santa.shadow.texture.key,
                occlusion: scene.santa.overlap(), support: scene.santa.support() } };
        });
        assert.deepEqual([data.begin.x, data.begin.y], [520, 76]);
        assert.equal(data.begin.behindGrove, true);
        assert.ok(data.begin.actorDepth < data.begin.groveDepth);
        assert.equal(data.begin.interactive, false);
        assert.equal(data.begin.occlusion.exposed, 0, 'the first pose starts fully behind the grove');
        if (mode === 'high-resolution') assert.equal(data.begin.occlusion.snowyBough, 255, 'white boughs have no holes in the foreground mask');
        assert.equal(data.entrance.phase, 'run-in');
        assert.equal(data.entrance.flipX, true);
        assert.ok(data.entrance.x > 464 && data.entrance.x < data.begin.x);
        assert.equal(data.entrance.texture, 'santa_run_2' + (mode === 'high-resolution' ? '__snowcraft_redrawn8x' : ''));
        assert.equal(data.entrance.lift, 0, 'the contact frame plants its foot');
        assert.ok(data.entrance.occlusion.exposed > 100, 'the running pose is visible before the stop');
        assert.equal(data.entrance.shadow, 'santa_shadow_' + (mode === 'high-resolution' ? 'hd' : 'classic') + '_run_2_left');
        assert.ok(data.entrance.support.length > 0);
        for (const point of data.entrance.support) {
            assert.equal(point.onSole, true, 'contact shadow sits directly below an opaque boot sole');
            assert.ok(Math.abs(point.y - point.ground) < 0.2);
            assert.ok(point.height < 1.5, 'contact stays tight rather than floating under a broad blob');
        }
        await screenshot(page, 'santa-' + mode + '-run-in');
        await page.evaluate(() => SnowcraftGame.getScene().santa.advance(SnowcraftSanta.TIMING.entranceMs * 5 / 56));
        assert.equal(await page.evaluate(() => SnowcraftGame.getScene().santa.snapshot().frame), 'run_4');
        await screenshot(page, 'santa-' + mode + '-passing-step');
        data.peek = await page.evaluate(() => {
            const santa = SnowcraftGame.getScene().santa; santa.advance(SnowcraftSanta.TIMING.entranceMs * 5 / 56 + 1);
            return { ...santa.snapshot(), flipX: santa.sprite.flipX };
        });
        assert.equal(data.peek.phase, 'peek');
        assert.equal(data.peek.flipX, false);
        assert.deepEqual([data.peek.x, data.peek.y], [464, 76]);
        await screenshot(page, 'santa-' + mode + '-peek');
        const wink = await page.evaluate(() => {
            const santa = SnowcraftGame.getScene().santa; santa.advance(SnowcraftSanta.TIMING.peekMs - SnowcraftSanta.TIMING.entranceMs);
            return { state: santa.snapshot(), texture: santa.sprite.texture.key, backing: [santa.sprite.width, santa.sprite.height] };
        });
        assert.equal(wink.state.phase, 'wink');
        assert.equal(wink.texture, 'santa_wink' + (mode === 'high-resolution' ? '__snowcraft_redrawn8x' : ''));
        assert.deepEqual(wink.backing, mode === 'high-resolution' ? [512, 512] : [64, 64]);
        await screenshot(page, 'santa-' + mode + '-wink');
        await page.evaluate(() => SnowcraftGame.getScene().santa.advance(SnowcraftSanta.TIMING.winkMs));
        assert.equal(await page.evaluate(() => SnowcraftGame.getScene().santa.snapshot().phase), 'wave');
        await screenshot(page, 'santa-' + mode + '-wave');
        const waveFrames = [];
        for (const expected of ['wave_b', 'wave_c', 'wave_b']) {
            await page.evaluate(() => SnowcraftGame.getScene().santa.advance(150));
            const frame = await page.evaluate(() => SnowcraftGame.getScene().santa.snapshot().frame);
            assert.equal(frame, expected); waveFrames.push(frame);
            await screenshot(page, 'santa-' + mode + '-' + expected);
        }
        const nose = await page.evaluate(() => {
            const santa = SnowcraftGame.getScene().santa;
            santa.advance(SnowcraftSanta.TIMING.waveMs - 450);
            const states = [santa.snapshot()];
            for (let i = 0; i < 8; i++) { santa.advance(100); states.push(santa.snapshot()); }
            return states;
        });
        assert.ok(nose.every(s => s.phase === 'nose-twitch' && s.visible && s.behindGrove && s.x === 464 && s.y === 76));
        assert.deepEqual([...new Set(nose.map(s => s.frame))].sort(), ['nose_center', 'nose_left', 'nose_right']);
        await screenshot(page, 'santa-' + mode + '-nose-twitch');
        const charge = await page.evaluate(() => {
            const santa = SnowcraftGame.getScene().santa; santa.advance(SnowcraftSanta.TIMING.noseMs - 800 + 300);
            return { state: santa.snapshot(), body: santa.sprite.visible, shadow: santa.shadow.visible, particles: santa.magic.snapshot().particles };
        });
        assert.equal(charge.state.phase, 'magic'); assert.equal(charge.body, true); assert.equal(charge.shadow, true);
        assert.ok(charge.particles >= (mode === 'high-resolution' ? 24 : 8));
        if (mode === 'original') assert.ok(charge.particles <= 12, 'Original charge stays readable around the face');
        await screenshot(page, 'santa-' + mode + '-magic-charge');
        const flash = await page.evaluate(() => {
            // A live RAF start can leave the subtraction a fraction below
            // 520ms. Sample just past the boundary; unit tests cover it exactly.
            const santa = SnowcraftGame.getScene().santa; santa.advance(SnowcraftSanta.TIMING.flashAtMs - santa.snapshot().magicMs + .001);
            return { state: santa.snapshot(), body: santa.sprite.visible, shadow: santa.shadow.visible,
                contacts: santa.contacts.map(c => c.visible), magic: santa.magic.snapshot() };
        });
        assert.equal(flash.state.x, 464); assert.equal(flash.state.y, 76);
        assert.equal(flash.body, false); assert.equal(flash.shadow, false); assert.ok(flash.contacts.every(v => !v));
        assert.equal(flash.magic.flash, true); assert.equal(flash.magic.visible, true);
        assert.ok(flash.magic.particles >= (mode === 'high-resolution' ? 24 : 8));
        await screenshot(page, 'santa-' + mode + '-magic-flash');
        const afterglow = await page.evaluate(() => {
            const santa = SnowcraftGame.getScene().santa; santa.advance(450);
            return { state: santa.snapshot(), body: santa.sprite.visible, shadow: santa.shadow.visible, magic: santa.magic.snapshot() };
        });
        assert.equal(afterglow.body, false); assert.equal(afterglow.shadow, false);
        assert.equal(afterglow.magic.flash, false); assert.equal(afterglow.magic.visible, true);
        await screenshot(page, 'santa-' + mode + '-magic-afterglow');
        const end = await page.evaluate(() => {
            const scene = SnowcraftGame.getScene(); scene.santa.advance(SnowcraftSanta.TIMING.magicMs);
            return { visible: scene.santa.sprite.visible, shadow: scene.santa.shadow.visible, contacts: scene.santa.contacts.map(contact => contact.visible), magic: scene.santa.magic.snapshot(),
                fight: { score: scene.score, reds: scene.redTeam.map(k => k.hits), greens: scene.greenTeam.map(k => k.hits), balls: scene.projectiles.length } };
        });
        assert.equal(end.visible, false);
        assert.equal(end.shadow, false);
        assert.equal(end.magic.visible, false);
        assert.equal(end.magic.flash, false);
        assert.ok(end.contacts.every(visible => !visible));
        assert.deepEqual(end.fight, data.before);
        results.push({ mode, begin: data.begin, entrance: data.entrance, peek: data.peek, wink, waveFrames, nose, charge, flash, afterglow, end });
    }
    evidence.santa = results;
});

test("walk-on cancellation during Clock catch-up preserves dead kids and the next level's count", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "cancelled walk-on catch-up");
    const observations = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.audio.setMuted(true);
        const results = [];
        for (const kind of ['knockout', 'destroy', 'reset']) {
            scene.startLevel(0);
            const kid = scene.redTeam[0];
            const setMember = scene.setKidMember;
            let cancelling = false, cancelled = false, laterMutations = 0, atCancellation;
            scene.setKidMember = function (target, ...args) {
                if (target === kid && cancelled) laterMutations++;
                const result = setMember.call(this, target, ...args);
                if (target === kid && !cancelling && !cancelled) {
                    cancelling = true;
                    if (kind === 'knockout') this.knockOut(kid, 'death_0');
                    else if (kind === 'destroy') {
                        this.destroyKid(kid);
                        this.redTeam.splice(this.redTeam.indexOf(kid), 1);
                    } else this.startLevel(1);
                    cancelled = true;
                    atCancellation = { x: kid.x, y: kid.y, member: kid.memberName };
                }
                return result;
            };
            try {
                scene.time.preUpdate();
                scene.time.update(scene.time.now + 10000, 10000);
            } finally {
                scene.setKidMember = setMember;
            }
            const count = scene.walkingCount;
            scene.stopWalkOn(kid); // cancellation must also be idempotent
            results.push({ kind, cancelled, laterMutations, atCancellation,
                after: { x: kid.x, y: kid.y, member: kid.memberName },
                timerCleared: kid.walkTimer === null, walking: kid.isWalkingOntoField,
                alive: kid.isAlive, active: kid.active, count, countAfterRepeat: scene.walkingCount,
                level: scene.currentLevelIndex,
                nextWalking: [...scene.redTeam, ...scene.greenTeam].filter(target => target.isWalkingOntoField).length
            });
            if (kind === 'reset') {
                scene.time.preUpdate();
                scene.time.update(scene.time.now + 10000, 10000);
                results[results.length - 1].nextCompletedCount = scene.walkingCount;
            }
        }
        return results;
    });
    for (const result of observations) {
        assert.equal(result.cancelled, true, result.kind);
        assert.equal(result.laterMutations, 0, result.kind);
        assert.deepEqual(result.after, result.atCancellation, result.kind);
        assert.equal(result.timerCleared, true, result.kind);
        assert.equal(result.walking, false, result.kind);
        assert.equal(result.countAfterRepeat, result.count, result.kind);
        if (result.kind === 'reset') {
            assert.equal(result.level, 1);
            assert.equal(result.count, 8);
            assert.equal(result.nextWalking, 8);
            assert.equal(result.nextCompletedCount, 0);
        } else {
            assert.equal(result.count, 0, result.kind);
            if (result.kind === 'knockout') assert.equal(result.alive, false);
            else assert.equal(result.active, false);
        }
    }
    evidence.cancelledWalkOn = observations;
});

test("victory animates Congratulations then aligned greeting/replay; mouse replay resets level and score", { timeout: 30000 * SLOW }, async t => {
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

test("every surviving Green dances after a loss, including kids winding up a throw", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, "all survivors dance");
    await page.goto(baseURL + '/?debug&manualTime');
    await ready(page);
    await start(page);
    await page.evaluate(() => SnowcraftGame.getScene().jumpToLevel(1));
    await active(page);
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.game.loop.sleep();
        scene.projectiles.forEach(ball => scene.destroyBall(ball));
        scene.projectiles = [];
        scene.greenTeam.forEach(kid => {
            scene.setReady(kid);
            scene.motion.reset(kid);
        });
        // Three throws would keep their HD charging poses after their queued
        // releases are cancelled by the loss, leaving only two kids dancing.
        scene.greenTeam.slice(0, 3).forEach(kid => scene.startGreenThrow(kid));
        scene.redTeam.forEach(kid => scene.knockOut(kid, 'death_0'));
    });
    const samples = [];
    for (const mode of ['high-resolution', 'original', 'high-resolution']) {
        await page.locator('#artwork-select').selectOption(mode);
        const cycle = await page.evaluate(() => {
            const scene = SnowcraftGame.getScene();
            const sample = () => {
                scene.motion.update();
                return scene.greenTeam.map(kid => ({
                    alive: kid.isAlive,
                    pose: kid.memberName,
                    expected: scene.artwork.mode === 'original' ? kid.memberSpec.key
                        : SnowcraftArtwork.characterTextureKey(kid.memberSpec.key),
                    rendered: (kid.bodySprite.visible ? kid.bodySprite : kid.list.at(-1)).texture.key
                }));
            };
            const frames = [sample()];
            for (let i = 0; i < 3; i++) {
                advanceTime(250);
                frames.push(sample());
            }
            return frames;
        });
        for (const frame of cycle) {
            assert.equal(frame.length, 5);
            for (const [index, kid] of frame.entries()) {
                assert.equal(kid.alive, true);
                assert.equal(kid.pose, 'G yea');
                assert.equal(kid.rendered, kid.expected, mode + ' kid ' + index + ' renders its dance frame');
            }
        }
        for (let i = 0; i < 5; i++) {
            assert.equal(new Set(cycle.map(frame => frame[i].rendered)).size, 3, 'each survivor cycles all dance frames');
        }
        samples.push({ mode, cycle });
    }
    await page.evaluate(() => {
        SnowcraftGame.getScene().showLossScreen();
        advanceTime(1000);
    });
    await screenshot(page, 'all-survivors-dancing');
    evidence.survivorDances = samples;
});

test("loss score and queued audio reveal inset replay; keyboard activation resets the game", { timeout: 30000 * SLOW }, async t => {
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
    await page.waitForFunction(() => SnowcraftGame.getScene().playAgainButton.visible, null, { timeout: 15000 * SLOW });
    await page.waitForTimeout(1200);
    const end = await geometry(page);
    assert.ok(end.labels.some(label => label.text === "SCORE: 66"));
    assertAnchors(end);
    await screenshot(page, "loss-score-replay");
    await replay(page, "keyboard");
    evidence.loss = end;
});

test("music and mute-all control actual playback independently and persist across rebuild/reload", { timeout: 90000 * SLOW }, async t => {
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

test("desktop scales, HiDPI and fullscreen keep browser text anchored within the game", { timeout: 30000 * SLOW }, async t => {
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

test("phone rotates back to portrait after fullscreen, actual touch drag/throw and touch replay", { timeout: 35000 * SLOW }, async t => {
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

test("HD motion interpolates walk-on without moving logic, and preserves Original steps", { timeout: 90000 * SLOW }, async t => {
    const { page } = await open(t, 'HD walk-on presentation');
    await page.goto(baseURL + '/?debug&manualTime'); await ready(page);
    await start(page);
    await page.evaluate(() => SnowcraftGame.getGame().loop.sleep());
    const samples = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.artwork.setMode('high-resolution');
        const result = [];
        for (let n = 0; n < 50; n++) {
            advanceTime(1000 / 60);
            const kid = scene.redTeam[0], p = scene.motion.snapshot().kids[0];
            result.push({ logical: [kid.x, kid.y], drawn: [p.x, p.y], phase: p.phase, frame: p.frame,
                visible: !kid.bodySprite.visible, x: kid.x, y: kid.y });
        }
        return result;
    });
    assert.ok(samples.some((s, i) => i && s.logical[0] === samples[i - 1].logical[0] && s.drawn[0] !== samples[i - 1].drawn[0]));
    assert.ok(new Set(samples.map(s => s.phase)).size >= 6);
    assert.ok(samples.every(s => s.visible));
    await screenshot(page, 'hd-smooth-walk-on');
    const original = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), before = scene.redTeam.map(k => [k.x, k.y]);
        scene.artwork.setMode('original'); scene.motion.refresh();
        return { before, after: scene.redTeam.map(k => [k.x, k.y]), visible: scene.redTeam.every(k => k.bodySprite.visible) };
    });
    assert.deepEqual(original.before, original.after); assert.ok(original.visible);
    const finish = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene(); scene.artwork.setMode('high-resolution');
        advanceTime(5000); scene.stopAI(); scene.greenTeam.forEach(k => { scene.cancelActions(k); scene.setReady(k); scene.motion.reset(k); });
        return { count: scene.walkingCount, active: scene.isLevelActive, bannerComplete: scene.textFadeComplete, positions: scene.redTeam.map(k => [k.x, k.y, k.finalX, k.finalY]),
            contacts: scene.motion.snapshot().kids.map(k => k.contacts) };
    });
    assert.equal(finish.count, 0); assert.equal(finish.active, finish.bannerComplete, 'activation still waits for the existing banner');
    finish.positions.forEach(p => assert.deepEqual(p.slice(0, 2), p.slice(2)));
    assert.ok(finish.contacts.every(n => n >= 1));
    // Software-rendered CI can take longer to capture after manual stepping.
    await page.screenshot({ path: path.join(output, 'hd-planted-arrivals.png'), timeout: 60000 * SLOW });
    evidence.motionWalk = { samples, original, finish };
});

test("HD throws, backward falls, recovery, projectiles and idle leave mechanics authoritative", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, 'HD actions and effects');
    await page.goto(baseURL + '/?debug&manualTime'); await ready(page);
    await start(page); await active(page);
    await page.evaluate(() => SnowcraftGame.getGame().loop.sleep());
    const setup = await page.evaluate(() => {
        const s = SnowcraftGame.getScene(); s.stopAI();
        s.greenTeam.forEach(k => { s.cancelActions(k); s.setReady(k); s.motion.reset(k); });
        s.projectiles.forEach(b => s.destroyBall(b)); s.projectiles = []; s.artwork.setMode('high-resolution');
        const k = s.redTeam[0]; s.activePlayer = k; s.isDragging = true; s.motion.charge(k); s.motion.update();
        const gather = s.motion.snapshot().kids[0].frame; advanceTime(260);
        const cock = s.motion.snapshot().kids[0].frame;
        s.throwSnowball(k, 8); s.activePlayer = null; s.isDragging = false; s.motion.update();
        const release = s.motion.snapshot().kids[0].frame;
        return { gather, cock, release };
    });
    assert.equal(setup.gather, 'R_gather'); assert.equal(setup.cock, 'R_cock'); assert.equal(setup.release, 'R_release');
    const ball = await page.evaluate(() => {
        const s = SnowcraftGame.getScene(), b = s.projectiles[0];
        const before = { gx: b.gx, gy: b.gy, range: b.range, phase: b.phase };
        const step = Math.min(10, 49 - s.ballClock); advanceTime(step);
        return { before, after: { gx: b.gx, gy: b.gy, range: b.range, phase: b.phase }, drawn: s.motion.snapshot().balls[0] };
    });
    assert.deepEqual(ball.before, ball.after); assert.ok(ball.drawn.x < ball.before.gx);
    await screenshot(page, 'hd-throw-projectile');
    const hit = await page.evaluate(() => {
        const s = SnowcraftGame.getScene(), k = s.redTeam[0]; s.handleHit(k); s.motion.update();
        const snapshots = [s.motion.snapshot().kids[0]];
        for (const ms of [100, 150, 120, 150, 120]) { advanceTime(ms); snapshots.push(s.motion.snapshot().kids[0]); }
        return { frames: snapshots.map(p => p.frame), contacts: snapshots.map(p => p.contacts), dazed: k.isDazed, hits: k.hits };
    });
    assert.deepEqual(hit.frames.slice(0, 5), ['R_recoil', 'R_fall', 'cast_009_R_hit__snowcraft_redrawn8x', 'R_kneel', 'R_rise']);
    assert.equal(hit.contacts[1], 0); assert.equal(hit.dazed, true); assert.equal(hit.hits, 1);
    await screenshot(page, 'hd-daze-contact');
    const down = await page.evaluate(() => {
        const s = SnowcraftGame.getScene(), k = s.greenTeam[0]; k.hits = 1; s.handleHit(k); s.motion.update();
        advanceTime(230); const held = s.motion.snapshot().kids[3]; const immune = k.isImmune;
        // The down hold has no intermediate presentation to inspect. Advance
        // the real Phaser clock in one step instead of rendering 138 frames.
        let game = s.game, now = game.loop.now + 2300; game.step(now, 2300); game.loop.now = now;
        const recovery = s.motion.snapshot().kids[3];
        return { held, immune, recovery, stillHurt: k.ai === 'hurt', immuneAfter: k.isImmune };
    });
    assert.equal(down.held.frame, 'cast_032_G_down__snowcraft_redrawn8x'); assert.equal(down.immune, true);
    assert.equal(down.recovery.frame, 'G_kneel'); assert.equal(down.immuneAfter, false); assert.equal(down.stillHurt, true);
    const idle = await page.evaluate(() => {
        const s = SnowcraftGame.getScene(), game = s.game;
        let now = game.loop.now + 3000; game.step(now, 3000); game.loop.now = now;
        s.redTeam.forEach(k => { s.stopDaze(k); s.showKidIdle(k); s.motion.reset(k); });
        const frames = new Set(), scales = new Set();
        for (let i = 0; i < 82; i++) { now = game.loop.now + 100; game.step(now, 100); game.loop.now = now; const k = s.redTeam[0]; frames.add(s.motion.snapshot().kids[0].frame); scales.add(k.list.at(-1).scaleY); }
        return { frames: [...frames], scales: scales.size, hits: s.redTeam[0].hits, particles: s.motion.snapshot().particles };
    });
    assert.ok(idle.frames.includes('R_blink')); assert.ok(idle.frames.includes('R_shift')); assert.ok(idle.scales > 20);
    assert.equal(idle.hits, 1); assert.equal(idle.particles, 0);
    await screenshot(page, 'hd-idle-gameplay'); evidence.motionActions = { setup, ball, hit, down, idle };
});

test("a Red charging a snowball keeps his body size through incoming hits and knockout", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, 'Red hit size continuity');
    await page.goto(baseURL + '/?debug&manualTime'); await ready(page); await start(page); await active(page);
    await page.locator('#artwork-select').selectOption('high-resolution');
    await page.evaluate(() => {
        const s = SnowcraftGame.getScene(); s.game.loop.sleep(); s.score = 17;
        s.greenTeam.forEach(k => { s.cancelActions(k); s.setReady(k); s.motion.reset(k); });
        s.projectiles.forEach(b => s.destroyBall(b)); s.projectiles = [];
        s.inspectRed = () => {
            const k = s.redTeam[1], image = k.list.at(-1), source = image.texture.getSourceImage();
            const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
            const ctx = c.getContext('2d'); ctx.drawImage(source, 0, 0);
            const p = ctx.getImageData(0, 0, c.width, c.height).data; let count = 0, mx = 0, my = 0;
            for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
                const i = (y * c.width + x) * 4, [r, g, b, a] = p.slice(i, i + 4);
                if (a >= 160 && (r > 45 && r > g * 1.25 && r > b * 1.1 || b > 45 && b > r * 1.15 && b > g * 1.3)) { count++; mx += x; my += y; }
            }
            const x = (mx / count - image.displayOriginX) * image.scaleX, y = (my / count - image.displayOriginY) * image.scaleY;
            return { frame: image.texture.key, bodyArea: count * image.scaleX * image.scaleY,
                centre: [k.x + image.x + x * Math.cos(image.rotation) - y * Math.sin(image.rotation),
                    k.y + image.y + x * Math.sin(image.rotation) + y * Math.cos(image.rotation)],
                logical: [k.x, k.y], alive: k.isAlive, hits: k.hits, dazed: k.isDazed, dragging: s.isDragging,
                contacts: s.motion.snapshot().kids[1].contacts, stars: k.list.find(o => o.type === 'Graphics').visible,
                originalWidth: k.bodySprite.displayWidth, expectedOriginalWidth: k.memberSpec.w };
        };
    });
    const cases = [];
    for (const lethal of [false, true]) {
        const pos = await page.evaluate(lethal => {
            const s = SnowcraftGame.getScene(), k = s.redTeam[1]; s.stopDaze(k); s.motion.reset(k); k.hits = lethal ? 1 : 0;
            k.isAlive = true; k.isImmune = false; k.setAlpha(1).setPosition(380, 220); s.showKidIdle(k);
            s.motion.update(); return { x: k.x, y: k.y };
        }, lethal);
        const box = await page.locator('canvas').boundingBox();
        await page.mouse.move(box.x + pos.x * box.width / 592, box.y + (pos.y - 14) * box.height / 320);
        await page.evaluate(() => advanceTime(17)); await page.mouse.down();
        const charging = await page.evaluate(() => { advanceTime(500); return SnowcraftGame.getScene().inspectRed(); });
        assert.equal(charging.dragging, true); assert.equal(charging.frame, 'motion_R_cock');
        await screenshot(page, 'red-size-' + (lethal ? 'lethal-' : '') + 'charging');
        const impact = await page.evaluate(() => {
            const s = SnowcraftGame.getScene(), k = s.redTeam[1], g = s.greenTeam[0], hits = k.hits;
            g.setPosition(k.x - 80, k.y - 26); s.throwSnowball(g, 8);
            for (let i = 0; i < 20 && k.hits === hits; i++) advanceTime(1000 / 60);
            s.redImpactAt = s.time.now; return s.inspectRed();
        });
        assert.equal(impact.hits, lethal ? 2 : 1, 'a real incoming projectile strikes the charging kid');
        assert.equal(impact.dragging, false); assert.equal(impact.originalWidth, impact.expectedOriginalWidth);
        const poses = [impact];
        for (const at of lethal ? [100, 205, 220, 600] : [100, 250, 370, 520, 700, 1400, 4550]) {
            const sample = await page.evaluate(at => {
                const s = SnowcraftGame.getScene(), elapsed = at - (s.time.now - s.redImpactAt);
                if (at >= 1400) { const now = s.game.loop.now + elapsed; s.game.step(now, elapsed); s.game.loop.now = now; }
                else advanceTime(elapsed);
                return s.inspectRed();
            }, at);
            poses.push(sample);
            assert.deepEqual(sample.logical, charging.logical);
            assert.ok(sample.bodyArea / charging.bodyArea > .88 && sample.bodyArea / charging.bodyArea < 1.10,
                JSON.stringify({ lethal, at, before: charging.bodyArea, after: sample.bodyArea, frame: sample.frame }));
            if ([250, 700, 220, 4550].includes(at)) await screenshot(page, 'red-size-' + (lethal ? 'lethal-' : '') + at);
        }
        if (lethal) {
            assert.ok(Math.hypot(...poses[2].centre.map((v, i) => v - poses[3].centre[i])) < 1.5, 'fall and corpse share a continuous body centre');
        } else {
            const dazed = poses[5]; assert.equal(dazed.dazed, true); assert.equal(dazed.frame, 'motion_R_ready');
            assert.ok(dazed.contacts >= 1); assert.equal(dazed.stars, true); assert.equal(poses.at(-1).dazed, false);
        }
        await page.mouse.up(); cases.push({ lethal, charging, poses });
    }
    evidence.redSizeContinuity = cases;
});

test("both teams' snowballs stay visibly outlined against snow on desktop and phone", { timeout: 45000 * SLOW }, async t => {
    const samples = [];
    for (const phone of [false, true]) {
        const { page } = await open(t, 'visible snowballs ' + (phone ? 'phone' : 'desktop'), phone
            ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {});
        await page.evaluate(() => {
            const s = SnowcraftGame.getScene(); s.game.loop.sleep(); s.startLevel(0); s.stopAI(); s.hideScoreBanner();
            [...s.redTeam, ...s.greenTeam].forEach(k => { s.stopWalkOn(k); s.motion.reset(k); if (k.debugLabel) k.debugLabel.setVisible(false); });
            s.redTeam.forEach((k, i) => k.setPosition(i ? 560 + i * 10 : 480, i ? 280 + i * 10 : 245));
            s.greenTeam.forEach((k, i) => k.setPosition(i ? 20 + i * 10 : 110, i ? 20 + i * 10 : 65));
            s.isLevelActive = true; s.ballClock = 0;
        });
        for (const mode of ['high-resolution', 'original']) for (const phase of ['fly', 'drop']) {
            const points = await page.evaluate(({ mode, phase }) => {
                const s = SnowcraftGame.getScene(); s.artwork.setMode(mode); s.motion.refresh();
                s.throwSnowball(s.redTeam[0], 8); s.throwSnowball(s.greenTeam[0], 8);
                for (let i = 0; i < 4; i++) s.stepBalls();
                if (phase === 'drop') s.projectiles.forEach(b => { b.phase = phase; b.frame = 1; s.setBallFrame(b); });
                s.game.step(s.game.loop.now, 0);
                const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect(), camera = s.cameras.main;
                const images = s.children.list.filter(i => i.type === 'Image' && i.depth === 60 && i.visible);
                return images.map(i => {
                    const x = i.x + (mode === 'original' ? .5 : 0), y = i.y - (mode === 'original' ? (phase === 'fly' ? 33.5 : 25.5) : 0);
                    const p = camera.matrix.transformPoint(x, y);
                    return { x: rect.x + p.x * rect.width / canvas.width, y: rect.y + p.y * rect.height / canvas.height,
                        scale: rect.width / 592, width: i.displayWidth };
                });
            }, { mode, phase });
            assert.equal(points.length, 2);
            const foreground = await page.screenshot({ scale: 'css' });
            await writeFile(path.join(output, 'snowballs-' + (phone ? 'phone-' : 'desktop-') + mode + '-' + phase + '.png'), foreground);
            await page.evaluate(() => {
                const s = SnowcraftGame.getScene(); s.projectiles.forEach(b => s.destroyBall(b)); s.projectiles = [];
                s.game.step(s.game.loop.now, 0);
            });
            const background = await page.screenshot({ scale: 'css' });
            await writeFile(path.join(output, 'snowball-background-' + (phone ? 'phone-' : 'desktop-') + mode + '-' + phase + '.png'), background);
            const contrast = await page.evaluate(async ({ foreground, background, points }) => {
                async function pixels(data) {
                    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
                    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
                    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
                    return { data: ctx.getImageData(0, 0, c.width, c.height).data, width: c.width };
                }
                const a = await pixels(foreground), b = await pixels(background);
                return points.map(p => {
                    let count = 0, left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
                    const radius = Math.ceil(7 * p.scale);
                    for (let y = Math.round(p.y) - radius; y <= Math.round(p.y) + radius; y++) for (let x = Math.round(p.x) - radius; x <= Math.round(p.x) + radius; x++) {
                        const n = (y * a.width + x) * 4;
                        if (Math.max(...[0, 1, 2].map(k => Math.abs(a.data[n + k] - b.data[n + k]))) >= 35) {
                            count++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
                        }
                    }
                    return { count, width: (right - left + 1) / p.scale, height: (bottom - top + 1) / p.scale };
                });
            }, { foreground: foreground.toString('base64'), background: background.toString('base64'), points });
            contrast.forEach((c, i) => {
                assert.ok(c.width >= 7.5 && c.height >= 7.5, JSON.stringify({ phone, mode, phase, point: points[i], c }));
                assert.ok(c.count >= 5 * points[0].scale ** 2, 'a visible rim survives screen scaling');
            });
            samples.push({ phone, mode, phase, contrast });
        }
    }
    evidence.snowballVisibility = samples;
});

test("muted level clear with other snowballs in flight starts the next level and keeps running", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "muted level clear", {}, true, { storage: { "snowcraft-muted": "1" } });
    await start(page);
    await active(page);
    const result = await page.evaluate(async () => {
        const scene = SnowcraftGame.getScene();
        const [last, ...others] = scene.greenTeam;
        others.forEach(kid => scene.knockOut(kid, "death_0"));
        const red = scene.redTeam[0];
        // Twelve fly steps away: the second ball is thrown later, so it sits
        // after the killing ball in the list when the level restarts.
        last.x = red.x - 240; last.y = red.y - 120; last.hits = 2; last.isImmune = false; last.ai = "hurt";
        scene.throwSnowball(red, 8);
        await new Promise(resolve => setTimeout(resolve, 300));
        scene.throwSnowball(scene.redTeam[1], 8);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const frame = scene.game.loop.frame;
        await new Promise(resolve => setTimeout(resolve, 500));
        return { muted: scene.audio.isMuted(), level: scene.currentLevelIndex + 1, frames: scene.game.loop.frame - frame, reds: scene.redTeam.length };
    });
    assert.equal(result.muted, true);
    assert.equal(result.level, 2);
    assert.equal(result.reds, 3);
    assert.ok(result.frames > 5, "the game loop is still running: " + result.frames);
    evidence.mutedLevelClear = result;
});

test("intro jingle plays through footsteps and throws, stops on mute, and returns after Play Again", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, "intro jingle", {}, true, { storage: { "snowcraft-artwork": "original" } });
    const playing = () => page.evaluate(() => SnowcraftGame.getScene().sound.getAllPlaying().map(sound => sound.key));
    await start(page);
    await page.waitForFunction(() => SnowcraftGame.getScene().audio.getPlayLog().some(entry => entry.soundId === "step"));
    assert.ok((await playing()).includes("sfx_intro"), "footsteps leave the intro playing");
    await active(page);
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.throwSnowball(scene.redTeam[0], 2);
    });
    const afterThrow = await playing();
    assert.ok(afterThrow.includes("sfx_intro") && afterThrow.includes("sfx_whoosh_percussive"), JSON.stringify(afterThrow));
    await page.locator("#mute-checkbox").check();
    assert.deepEqual(await playing(), []);
    await page.locator("#mute-checkbox").uncheck();
    await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        scene.isLevelActive = false;
        scene.showLossScreen();
    });
    await replay(page, "mouse");
    await page.waitForFunction(() => SnowcraftGame.getScene().sound.getAllPlaying().some(sound => sound.key === "sfx_intro"), null, { timeout: 5000 * SLOW });
    const replayed = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        return { skipped: scene.audio.getSkippedLog().map(entry => entry.soundId + ":" + entry.reason),
            musicInstances: scene.sound.sounds.filter(sound => sound.key === "music").length, musicPlaying: scene.music.isPlaying };
    });
    assert.ok(!replayed.skipped.some(entry => entry.startsWith("intro:") || entry.startsWith("music:")), JSON.stringify(replayed.skipped));
    assert.equal(replayed.musicInstances, 1);
    assert.equal(replayed.musicPlaying, true);
    evidence.introJingle = { afterThrow, replayed };
});

test("grabbing a Red again right after a throw keeps the charging pose", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "quick re-grab", {}, true, { storage: { "snowcraft-artwork": "original", "snowcraft-muted": "1" } });
    await start(page);
    await active(page);
    const canvas = await page.locator("canvas").boundingBox();
    const kid = await page.evaluate(() => { const red = SnowcraftGame.getScene().redTeam[0]; return { x: red.x, y: red.y - 10 }; });
    await page.mouse.move(canvas.x + kid.x * canvas.width / 592, canvas.y + kid.y * canvas.height / 320);
    await page.waitForFunction(() => { const scene = SnowcraftGame.getScene(); return scene.hoveredPlayer === scene.redTeam[0]; });
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.mouse.down();
    await page.waitForTimeout(400);
    const held = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), red = scene.redTeam[0];
        return { dragging: scene.isDragging && scene.activePlayer === red, pose: red.memberName };
    });
    await page.mouse.up();
    assert.deepEqual(held, { dragging: true, pose: "R cock" });
});

test("the canvas is re-sized in place when the game grows to full screen", { timeout: 30000 * SLOW }, async t => {
    const { page } = await open(t, "render scale", { viewport: { width: 760, height: 620 } });
    const measure = () => page.evaluate(() => {
        const scene = SnowcraftGame.getScene();
        return { canvas: document.querySelector("canvas").width, wanted: SnowcraftGame.computeLayout().renderScale * 592,
            zoom: scene.cameras.main.zoom, level: scene.currentLevelIndex, active: scene.isLevelActive };
    });
    await start(page);
    await active(page);
    const small = await measure();
    assert.equal(small.canvas, small.wanted);
    await page.setViewportSize({ width: 1900, height: 1050 });
    await page.keyboard.press("f");
    await page.waitForFunction(() => document.querySelector("canvas").width === SnowcraftGame.computeLayout().renderScale * 592 && document.querySelector("canvas").width > 1184);
    const large = await measure();
    assert.ok(large.canvas > small.canvas && large.zoom > small.zoom, JSON.stringify({ small, large }));
    assert.equal(large.active, true, "the level keeps running");
    const canvas = await page.locator("canvas").boundingBox();
    const kid = await page.evaluate(() => { const red = SnowcraftGame.getScene().redTeam[1]; return { x: red.x, y: red.y - 10 }; });
    await page.mouse.move(canvas.x + kid.x * canvas.width / 592, canvas.y + kid.y * canvas.height / 320);
    await page.waitForFunction(() => { const scene = SnowcraftGame.getScene(); return scene.hoveredPlayer === scene.redTeam[1]; });
    await page.keyboard.press("f");
    await page.setViewportSize({ width: 760, height: 620 });
    await page.waitForFunction(width => document.querySelector("canvas").width === width, small.canvas);
    evidence.renderScale = { small, large };
});

test("the published URL (no debug) plays, and the difficulty selector rebuilds the game", { timeout: 60000 * SLOW }, async t => {
    const { page } = await open(t, "production page", {}, true, { query: "/" });
    assert.equal(await page.evaluate(() => typeof window.advanceTime), "undefined");
    await start(page);
    await page.waitForFunction(() => SnowcraftGame.getScene().isLevelActive, null, { timeout: 15000 * SLOW });
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().redTeam.some(kid => kid.debugLabel)), false);
    const hitsToKnockOut = () => page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), green = scene.greenTeam[0];
        scene.stopAI();
        let hits = 0;
        while (green.isAlive && hits < 9) { green.isImmune = false; scene.handleHit(green); hits++; }
        return hits;
    });
    assert.equal(await hitsToKnockOut(), 3);
    for (const [value, expected] of [["3", 4], ["1", 2]]) {
        const previous = await page.evaluateHandle(() => SnowcraftGame.getGame());
        await page.locator("#difficulty-select").selectOption(value);
        await page.waitForFunction(old => SnowcraftGame.getGame() !== old && SnowcraftGame.getScene()?.scoreBanner?.node && SnowcraftGame.getScene().awaitingTitleClick, previous);
        await page.waitForTimeout(150);
        await start(page);
        await page.waitForFunction(() => SnowcraftGame.getScene().isLevelActive, null, { timeout: 15000 * SLOW });
        assert.equal(await hitsToKnockOut(), expected, "difficulty " + value);
    }
});

test("parity-check.html reports every recovered constant as passing", { timeout: 30000 * SLOW }, async t => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ test: "parity page", type: "pageerror", message: error.stack }));
    await page.goto(baseURL + "/parity-check.html");
    const report = await page.locator("#out").textContent();
    assert.ok(!report.includes("FAIL") && report.trim().endsWith("ALL PASSED"), report);
});

test("Original artwork skips the high-resolution pack until the player switches to it", { timeout: 60000 * SLOW }, async t => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    t.after(() => context.close());
    context.setDefaultTimeout(30000 * SLOW);
    for (const host of ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"]) await context.route("https://" + host + "/**", replayThirdParty);
    await context.addInitScript(() => { if (localStorage.getItem("snowcraft-artwork") === null) localStorage.setItem("snowcraft-artwork", "original"); });
    const page = await context.newPage();
    const hdRequests = [];
    page.on("request", request => { // The page itself shows a few redrawn character frames; the game's pack is the motion, scenery and Santa art.
        if (/\/assets\/(hd\/(motion|scenery)|santa\/hd)\/.*\.png$/.test(request.url())) hdRequests.push(request.url()); });
    page.on("pageerror", error => errors.push({ test: "lazy artwork", type: "pageerror", message: error.stack }));
    page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push({ test: "lazy artwork", type: "console", message: message.text() }); });
    await page.goto(baseURL + "/?debug", { waitUntil: "domcontentloaded" });
    await ready(page);
    await start(page);
    await active(page);
    assert.deepEqual(hdRequests, [], "Original artwork does not download the redrawn pack");
    await page.evaluate(() => { const scene = SnowcraftGame.getScene(); scene.score = 7; scene.redTeam[0].hits = 1; });
    await page.locator("#artwork-select").selectOption("high-resolution");
    await page.waitForFunction(() => SnowcraftGame.getScene().artwork.mode === "high-resolution");
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => {
        const scene = SnowcraftGame.getScene(), frames = SnowcraftGame.getScene().motion.snapshot().kids.map(kid => kid.frame);
        const ground = scene.children.list.find(object => object.snowcraftOriginalTextureKey === "cast_ground");
        return { score: scene.score, hits: scene.redTeam[0].hits, active: scene.isLevelActive, frames, ground: ground.texture.key,
            missing: scene.children.list.filter(object => object.texture && object.texture.key === "__MISSING" && object.visible).length };
    });
    assert.ok(hdRequests.length > 100, "the pack is fetched on demand: " + hdRequests.length);
    assert.deepEqual({ score: state.score, hits: state.hits, active: state.active, missing: state.missing }, { score: 7, hits: 1, active: true, missing: 0 });
    assert.ok(state.frames.every(frame => /^[RG]_/.test(frame)), JSON.stringify(state.frames));
    assert.match(state.ground, /redrawn4x$/);
    await screenshot(page, "lazy-hd-artwork");
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().artwork.mode), "high-resolution");
});

test("the game sits inside the card and inside the first screen at common sizes", { timeout: 45000 * SLOW }, async t => {
    const { page } = await open(t, "card layout", {}, true, { query: "/" });
    const sizes = [];
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1180, 820], [820, 1180], [760, 620]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(750);
        const box = await page.evaluate(() => {
            const canvas = document.querySelector("canvas").getBoundingClientRect(), slot = document.querySelector(".game-slot").getBoundingClientRect();
            return { top: canvas.top, bottom: canvas.bottom, left: canvas.left, right: canvas.right, width: canvas.width,
                slotLeft: slot.left, slotRight: slot.right, pageWidth: document.documentElement.scrollWidth };
        });
        const label = width + "x" + height + " " + JSON.stringify(box);
        assert.ok(box.top >= 0 && box.bottom <= height, "game is fully in view at " + label);
        assert.ok(box.left >= box.slotLeft && box.right <= box.slotRight, "game stays on its leaf at " + label);
        assert.ok(box.width >= Math.min(560, width - 80), "game is not shrunk at " + label);
        assert.ok(box.pageWidth <= width, "no sideways scroll at " + label);
        sizes.push({ width, height, box });
    }
    evidence.cardLayout = sizes;
});

test("sending the card copies the link and cancels the envelope with today's postmark", { timeout: 30000 * SLOW }, async t => {
    const { page, context } = await open(t, "send the card", {}, true, { query: "/" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // When the browser refuses the clipboard, the address is offered for a manual copy and nothing is stamped.
    await page.evaluate(() => {
        window.realWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
        Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("denied")) });
    });
    await page.locator("[data-copy]").click();
    await page.waitForFunction(() => document.querySelector("[data-copy] [data-share-label]").textContent === "Copy the address");
    assert.deepEqual(await page.evaluate(() => ({
        struck: document.querySelectorAll(".postmark-sent.is-struck").length,
        selected: String(getSelection()).replace(/\s/g, "")
    })), { struck: 0, selected: "chiefinnovator.github.io/snowcraftai" });
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: window.realWriteText }));
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator(".stamp-send").click();
    await page.waitForFunction(() => document.querySelector(".postmark-sent.is-struck"));
    const sent = await page.evaluate(async () => ({
        clipboard: await navigator.clipboard.readText(),
        label: document.querySelector(".stamp-send [data-share-label]").textContent,
        status: document.querySelector(".share-status").textContent,
        year: document.querySelector("[data-sent-year]").textContent,
        stillOnTitle: SnowcraftGame.getScene().awaitingTitleClick
    }));
    assert.deepEqual(sent, { clipboard: "https://chiefinnovator.github.io/snowcraftai/", label: "Link copied", status: "Link copied",
        year: String(new Date().getFullYear()), stillOnTitle: true });
});

test("the 1999 and 2026 switch changes the live artwork, and the comparison line can be dragged", { timeout: 45000 * SLOW }, async t => {
    const { page } = await open(t, "two printings", {}, true, { query: "/" });
    const state = () => page.evaluate(() => ({
        drawn: SnowcraftGame.getScene().artwork.mode,
        select: document.getElementById("artwork-select").value,
        on: [...document.querySelectorAll(".edition.is-on input")].map(input => input.value),
        checked: [...document.querySelectorAll(".edition input:checked")].map(input => input.value),
        edition: document.documentElement.dataset.edition,
        saved: localStorage.getItem("snowcraft-artwork"),
        covered: document.querySelector(".plate-wipe").classList.contains("is-covering")
    }));
    const settled = mode => page.waitForFunction(mode => SnowcraftGame.getScene().artwork.mode === mode
        && !document.querySelector(".plate-wipe").classList.contains("is-covering"), mode);
    assert.deepEqual(await state(), { drawn: "high-resolution", select: "high-resolution", on: ["high-resolution"], checked: ["high-resolution"], edition: "2026", saved: null, covered: false });
    await start(page);
    await active(page);
    await page.locator(".edition").filter({ hasText: "1999" }).click();
    await settled("original");
    assert.deepEqual(await state(), { drawn: "original", select: "original", on: ["original"], checked: ["original"], edition: "1999", saved: "original", covered: false });
    assert.equal(await page.evaluate(() => SnowcraftGame.getScene().isLevelActive), true, "switching artwork does not restart the level");
    await page.locator('[data-edition="high-resolution"]').click();
    await settled("high-resolution");
    assert.deepEqual((await state()).on, ["high-resolution"]);
    // The game's own control still works, and the two prints follow it.
    await page.locator("#artwork-select").selectOption("original");
    await page.waitForFunction(() => document.querySelector(".edition.is-on input").value === "original");
    assert.equal((await state()).edition, "1999");
    await page.locator(".wipe-range").fill("20");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".wipe")).getPropertyValue("--split").trim()), "20%");
    await page.locator(".wipe").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".wipe img")].every(image => image.complete && image.naturalWidth === 1778));
    await screenshot(page, "two-printings");
});

test("browser matrix produces no uncaught page errors or console errors", () => {
    assert.deepEqual(errors, []);
});
