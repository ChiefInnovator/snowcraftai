// --- CONFIGURATION ---
const PARAMS = new URLSearchParams(location.search);
const DEBUG_MODE = PARAMS.has('debug'); // ?debug → coordinate labels + level-jump keys (1-9, 0, z)
const START_LEVEL = 1; // Level to start on (1-10)
let GAME_SCALE = 0; // 0 = fit the window; otherwise a fixed multiple of 600×320
let GAME_DIFFICULTY = 2; // 1=Easy, 2=Normal, 3=Hard
let game = null;
let snowcraftAudio = null;

const STAGE_W = SnowcraftParity.STAGE_W; // Director stage 592
const STAGE_H = SnowcraftParity.STAGE_H;
const DISPLAY_BASE_W = SnowcraftParity.DISPLAY_BASE_W;
const DISPLAY_BASE_H = SnowcraftParity.DISPLAY_BASE_H;

// Gameplay rules. Times in ms, distances in px. Numbers come from
// SnowcraftParity (VWSC Event Loop + Lingo). See docs/PARITY.md.
const P = SnowcraftParity;
const RULES = {
    greensPerLevel: P.LEVELS.map(l => l.gd), // 10 levels, then victory
    redHitsToKO: P.RED_HITS_TO_KO,
    greenHitsToKO: { 1: 2, 2: P.GREEN_HITS_TO_KO, 3: 4 },  // Easy/Hard are remake extras
    maxBallsPerTeam: P.MAX_BALLS_PER_TEAM,
    powerTickMs: P.TICK_MS * P.POWER_TICKS_PER_BAR, // 5 Director ticks ≈ 83.33 ms
    maxPower: P.MAX_POWER,
    ballTickMs: P.TICK_MS * (P.BALL_TEMPO_TICKS + 1), // 50 ms per snowball step
    // myTempo=5 and `the timer > myClock + myTempo` → 6/60 s per Lingo tick.
    redDazeMs: P.RED_DAZE_CYCLES * 3 * (P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1)),
    greenOwMs: P.GREEN_OW_MOVES * (P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1)),
    greenRecoverMs: P.GREEN_RECOVER_MOVES * (P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1)),
    greenDownMs: P.GREEN_DOWN_MOVES * (P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1)),
    aiTickMs: P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1), // 100 ms
    greenThrowPower: [5, 8],
    windupMs: 500,
    cockMs: [600, 1500],
    tossMs: 500,
};

// Phones: touch input, landscape play, lighter rendering.
const COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const TOUCH_GRAB_RADIUS = 34; // world px: how close a finger must land to a red kid
const TOUCH_LIFT = 36;        // world px: kid is drawn above the finger while dragging

function isCompactLandscape() {
    return !!(window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches);
}

// Full screen or a phone on its side: the game takes the whole viewport.
function isImmersive() {
    return !!document.fullscreenElement || isCompactLandscape();
}

function viewportSize() {
    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) return { w: vv.width, h: vv.height };
    return { w: window.innerWidth, h: window.innerHeight };
}

function computeLayout() {
    const vp = viewportSize();
    const immersive = isImmersive();
    const layout = P.computeDisplayLayout(
        immersive ? 0 : GAME_SCALE,
        vp.w,
        vp.h,
        window.devicePixelRatio || 1,
        immersive ? 0 : undefined,
        immersive ? 0 : undefined
    );
    if (COARSE_POINTER) layout.renderScale = Math.min(layout.renderScale, 2);
    return layout;
}

function sizeContainer(layout) {
    const el = document.getElementById('game-container');
    // Height comes from the CSS aspect ratio, and max-width keeps the box inside
    // the screen, so a rotation can never make the page wider than the phone.
    el.style.width = layout.width + 'px';
    el.style.height = '';
}

function rebuildGame() {
    if (game) game.destroy(true);
    game = new Phaser.Game(getConfig());
}

function changeDifficulty() {
    const newDifficulty = parseInt(document.getElementById('difficulty-select').value);
    if (newDifficulty !== GAME_DIFFICULTY) {
        GAME_DIFFICULTY = newDifficulty;
        rebuildGame();
    }
}

function changeScale() {
    const newScale = parseFloat(document.getElementById('scale-select').value);
    if (newScale !== GAME_SCALE) {
        GAME_SCALE = newScale;
        rebuildGame();
    }
}

function changeMute() {
    const box = document.getElementById('mute-checkbox');
    const muted = !!(box && box.checked);
    if (snowcraftAudio) snowcraftAudio.setMuted(muted);
}

// Phones report the new size late after a rotation, so lay out twice: once
// quickly, once after the browser settles. Phaser must re-fit after the
// container changes size.
let relayoutTimers = [];
function relayout() {
    relayoutTimers.forEach(clearTimeout);
    relayoutTimers = [120, 600].map(ms => setTimeout(() => {
        if (!game) return;
        sizeContainer(computeLayout());
        if (game.scale && game.scale.refresh) game.scale.refresh();
        updateRotateHint();
    }, ms));
}
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', relayout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
document.addEventListener('fullscreenchange', relayout);

// Portrait phones: suggest turning sideways (can be dismissed).
let rotateHintDismissed = false;
function updateRotateHint() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;
    const portrait = !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
    hint.hidden = !(COARSE_POINTER && portrait && !rotateHintDismissed);
}

function dismissRotateHint() {
    rotateHintDismissed = true;
    updateRotateHint();
}

function toggleFullscreen() {
    const target = document.querySelector('.play');
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
    }
    if (!target || !target.requestFullscreen) return;
    target.requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        })
        .catch(() => {});
}

function getConfig() {
    const layout = computeLayout();
    sizeContainer(layout);
    return {
        type: Phaser.AUTO,
        width: STAGE_W * layout.renderScale,
        height: STAGE_H * layout.renderScale,
        parent: 'game-container',
        backgroundColor: '#ffffff',
        pixelArt: true,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.NO_CENTER
        },
        callbacks: {
            preBoot: (g) => { g.registry.set('renderScale', layout.renderScale); }
        },
        scene: MainScene
    };
}

// Red kids must stay on or below this line; greens throw if they would cross it.
// Original: x = 2*(320 − y), from (0, 320) to (640, 0). [Lingo]
function centreLineY(x) {
    return P.centreLineY(x);
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // --- ASSET LOADING ---
        this.load.image('red_team_atlas', 'assets/player.png');
        this.load.image('green_team_atlas', 'assets/enemy.png');
        for (let i = 0; i <= 8; i++) this.load.image('power_' + i, 'assets/cast/power_' + i + '.png');
        this.load.image('cast_snowball', 'assets/cast/snowball.png');
        this.load.image('drop_0', 'assets/cast/drop_0.png');
        this.load.image('drop_1', 'assets/cast/drop_1.png');
        this.load.image('drop_2', 'assets/cast/drop_2.png');
        this.load.image('drop_3', 'assets/cast/drop_3.png');
        this.load.image('cast_splat', 'assets/cast/splat.png');
        this.load.image('melt_0', 'assets/cast/melt_0.png');
        this.load.image('melt_1', 'assets/cast/melt_1.png');
        this.load.image('melt_2', 'assets/cast/melt_2.png');
        this.load.image('melt_3', 'assets/cast/melt_3.png');
        this.load.image('playfield', 'assets/playField.png');
        this.load.image(P.CAST.ground.key, 'assets/cast/' + P.CAST.ground.file);
        this.load.image(P.CAST.title.key, 'assets/cast/' + P.CAST.title.file);
        this.load.image(P.CAST.levelWord.key, 'assets/cast/' + P.CAST.levelWord.file);
        Object.keys(P.CAST.levelDigit).forEach((n) => {
            const spec = P.CAST.levelDigit[n];
            this.load.image(spec.key, 'assets/cast/' + spec.file);
        });
        this.load.image(P.CAST.bonusRound.key, 'assets/cast/' + P.CAST.bonusRound.file);
        this.load.image(P.CAST.congrats.key, 'assets/cast/' + P.CAST.congrats.file);
        this.load.image(P.CAST.playAgain.key, 'assets/cast/' + P.CAST.playAgain.file);
        this.load.image('shadow', 'assets/shadow.png');
        P.CAST.kids.forEach((m) => this.load.image(m.key, 'assets/cast/' + m.file));
        this.load.json('walkon', 'assets/walkon.json');

        // Original channel-1 WAVs (paths relative to src/). Intro/BGM are remake extras.
        Object.keys(P.SOUND_FILES).forEach((id) => {
            this.load.audio('sfx_' + id, P.SOUND_FILES[id]);
        });
        this.load.audio('sfx_intro', 'assets/intro.mp3');
        this.load.audio('music', 'assets/musicAlt.mp3');
    }

    create(data) {
        this.renderScale = this.registry.get('renderScale') || 1;
        this.cameras.main.setZoom(this.renderScale).centerOn(STAGE_W / 2, STAGE_H / 2);

        // 1. Environment — original ground BITD, copy ink, loc (296,160).
        if (DEBUG_MODE) {
            let debugLine = this.add.graphics();
            debugLine.lineStyle(2, 0xff0000, 1);
            debugLine.lineBetween(0, STAGE_H, 640, 0);
            debugLine.setDepth(100);
        }

        const ground = P.CAST.ground;
        if (this.textures.exists(ground.key)) {
            const pf = this.add.image(ground.loc[0], ground.loc[1], ground.key);
            P.applyOrigin(pf, ground);
            pf.setDepth(-10);
        } else if (this.textures.exists('playfield')) {
            let pf = this.add.image(STAGE_W / 2, STAGE_H / 2, 'playfield');
            pf.setDisplaySize(STAGE_W, STAGE_H);
            pf.setDepth(-10);
        }

        this.scoreBanner = this.add.image(0, 0, P.CAST.title.key).setDepth(180).setVisible(false);
        this.scoreBannerDigit = this.add.image(0, 0, P.CAST.levelDigit[2].key).setDepth(181).setVisible(false);
        this.matteCache = {};

        this.walkon = this.cache.json.get('walkon') || [];

        // 3. Game Groups & State
        this.shadowGroup = this.add.group();
        this.projectiles = [];
        this.redTeam = [];
        this.greenTeam = [];
        this.isLevelActive = false;
        this.isDragging = false;
        this.activePlayer = null;
        this.hoveredPlayer = null;
        this.pressTime = 0;
        this.activePower = 0;
        this.score = 0;
        this.killsThisLevel = 0;
        this.lastStepSound = 0;
        this.aiTimer = null;
        this.ballClock = 0;

        // 4. UI Elements
        this.levelText = this.makeText(STAGE_W / 2, STAGE_H / 2, '', { fontSize: '60px', color: '#cc0000', fontStyle: 'bold', stroke: '#fff', strokeThickness: 6 })
            .setOrigin(0.5).setDepth(200).setVisible(false);
        this.subText = this.makeText(STAGE_W / 2, STAGE_H / 2 + 45, '', { fontSize: '16px', color: '#335', fontFamily: 'Arial', stroke: '#fff', strokeThickness: 4 })
            .setOrigin(0.5).setDepth(200).setVisible(false);
        // End-screen greeting, drawn as our own text where the original's holiday banner sat.
        this.greetingText = this.makeText(P.CAST.logo.loc[0], P.CAST.logo.loc[1], 'Happy Holidays', {
            fontSize: '30px', fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic bold',
            color: '#e0473c', stroke: '#ffffff', strokeThickness: 4
        }).setOrigin(0.5).setDepth(180).setVisible(false);
        this.scoreText = this.makeText(20, STAGE_H - 30, '', { fontSize: '20px', color: '#cc0000', fontStyle: 'bold', fontFamily: 'Arial', stroke: '#fff', strokeThickness: 4 })
            .setDepth(210).setVisible(false);
        if (this.textures.exists(P.CAST.playAgain.key)) {
            this.playAgainButton = this.add.image(0, 0, P.CAST.playAgain.key)
                .setDepth(210).setVisible(false).setInteractive({ useHandCursor: true });
        } else {
            this.playAgainButton = this.makeText(STAGE_W - 20, STAGE_H - 18, 'Play Again', {
                fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
                backgroundColor: '#cc0000', padding: { x: 12, y: 6 }
            }).setOrigin(1, 1).setDepth(210).setVisible(false).setInteractive({ useHandCursor: true });
        }
        this.playAgainButton.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
            if (this.audio) this.audio.restart();
            this.sound.stopAll();
            this.scene.restart({ skipTitle: true });
        });

        // Selection ring
        this.selectionCircle = this.add.graphics();
        this.selectionCircle.setDepth(-1);
        this.selectionCircle.setVisible(false);

        // Power meter: original `power 0`–`power 8` BITD members, loc = kid feet.
        this.powerMeter = this.add.image(0, 0, 'power_0').setDepth(100).setVisible(false);

        this.input.setDefaultCursor('url(assets/smallHand.png), pointer');
        this.music = this.sound.add('music', { loop: true, volume: 0.3 });

        this.audio = SnowcraftAudio.createSnowcraftAudio(SnowcraftAudio.createPhaserAdapter(this));
        snowcraftAudio = this.audio;
        const muteBox = document.getElementById('mute-checkbox');
        if (muteBox) {
            muteBox.checked = this.audio.isMuted();
            if (this.audio.isMuted()) this.audio.setMuted(true);
        }
        this.awaitingTitleClick = !(data && data.skipTitle);
        this.input.on('pointerdown', () => {
            this.unlockGameAudio();
            if (this.awaitingTitleClick) {
                this.awaitingTitleClick = false;
                this.subText.setVisible(false);
                this.startLevel(START_LEVEL - 1);
            }
        });

        // 5. Inputs
        this.input.mouse.disableContextMenu();

        this.input.on('pointermove', (pointer) => {
            const px = pointer.worldX, py = pointer.worldY;
            if (!this.isLevelActive) {
                if (this.hoveredPlayer) {
                    this.hideSelectionUI();
                    this.hoveredPlayer = null;
                }
                return;
            }

            // Dragging: the kid follows the pointer (keeping the grab offset), clamped to the red side
            if (this.isDragging && this.activePlayer && this.activePlayer.isAlive) {
                let newX = Math.round(px - this.grabOffsetX);
                let newY = Math.round(py - this.grabOffsetY);
                newX = Phaser.Math.Clamp(newX, 0, STAGE_W);
                newY = Phaser.Math.Clamp(newY, 0, STAGE_H);
                const minY = centreLineY(newX);
                if (newY < minY) newY = Math.round(minY);
                this.activePlayer.x = newX;
                this.activePlayer.y = newY;
                this.showKidFrame(this.activePlayer, 'throw_0');
                this.updateSelectionUI(this.activePlayer);
                return;
            }

            const over = this.kidAt(this.redTeam, px, py);
            if (over && over.isDazed) {
                // Dazed kids can't be grabbed
                if (this.hoveredPlayer) this.hideSelectionUI();
                this.hoveredPlayer = null;
                if (this.deniedKid !== over) {
                    this.deniedKid = over;
                    this.playOriginalEvent('dead_hover');
                }
                return;
            }
            this.deniedKid = null;

            if (over) {
                if (this.hoveredPlayer !== over) {
                    this.hoveredPlayer = over;
                    this.showSelectionUI(over);
                } else {
                    this.updateSelectionUI(over);
                }
            } else if (this.hoveredPlayer) {
                this.hideSelectionUI();
                this.hoveredPlayer = null;
            }
        });

        this.input.on('pointerdown', (pointer) => {
            if (!this.isLevelActive || this.isDragging) return;
            // Touch has no hover, so find the kid under (or near) the finger.
            const kid = pointer.wasTouch
                ? this.kidNear(this.redTeam, pointer.worldX, pointer.worldY, TOUCH_GRAB_RADIUS)
                : (this.hoveredPlayer || this.kidAt(this.redTeam, pointer.worldX, pointer.worldY));
            if (kid && kid.isDazed) {
                this.playOriginalEvent('dead_hover');
                return;
            }
            if ((pointer.wasTouch || pointer.leftButtonDown()) && kid && kid.isAlive) {
                if (this.hoveredPlayer !== kid) {
                    this.hoveredPlayer = kid;
                    this.showSelectionUI(kid);
                }
                this.activePlayer = kid;
                this.isDragging = true;
                this.pressTime = this.time.now;
                this.activePower = 0;
                // On touch, lift the kid above the finger so it stays visible.
                this.grabOffsetX = pointer.wasTouch ? 0 : pointer.worldX - kid.x;
                this.grabOffsetY = pointer.wasTouch ? TOUCH_LIFT : pointer.worldY - kid.y;
                kid.shadowLocked = true; // shadow stays at the grab point until release
                this.showKidFrame(kid, 'throw_0');
                this.showPowerMeter(kid);
            }
        });

        this.input.on('pointerup', (pointer) => {
            const kid = this.activePlayer;
            if (this.isDragging && kid && kid.isAlive && this.isLevelActive && (pointer.wasTouch || pointer.leftButtonReleased())) {
                kid.shadowLocked = false;
                this.throwSnowball(kid, this.currentPower());
                this.hidePowerMeter();
                this.isDragging = false;
                this.activePlayer = null;
                if (pointer.wasTouch) {
                    // No hover on touch: clear the ring once the throw is away.
                    this.hideSelectionUI();
                    this.hoveredPlayer = null;
                } else {
                    this.hoveredPlayer = kid;
                }
            }
        });

        this.input.on('pointerupoutside', () => {
            if (this.isDragging && this.activePlayer) {
                if (this.activePlayer.isAlive && !this.activePlayer.isDazed) this.showKidIdle(this.activePlayer);
                this.cancelDrag();
            }
        });

        if (DEBUG_MODE) {
            this.input.keyboard.on('keydown', (event) => {
                if (event.key >= '0' && event.key <= '9') {
                    const level = event.key === '0' ? 10 : parseInt(event.key);
                    this.jumpToLevel(level - 1);
                } else if (event.key === 'z') {
                    this.redTeam.forEach(k => this.reviveRed(k));
                }
            });
        }

        if (data && data.skipTitle) {
            this.startLevel(START_LEVEL - 1);
        } else {
            this.showTitle();
        }
    }

    makeText(x, y, text, style) {
        // Render text at the canvas resolution so it stays sharp when the camera is zoomed
        return this.add.text(x, y, text, { ...style, resolution: this.renderScale });
    }

    matteFor(key) {
        if (this.matteCache[key]) return this.matteCache[key];
        if (!this.textures.exists(key)) return null;
        const src = this.textures.get(key).getSourceImage();
        if (!src || !src.width) return null;
        const canvas = document.createElement('canvas');
        canvas.width = src.width;
        canvas.height = src.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(src, 0, 0);
        const data = ctx.getImageData(0, 0, src.width, src.height).data;
        const bits = new Uint8Array(src.width * src.height);
        for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        const mask = { w: src.width, h: src.height, bits: bits };
        this.matteCache[key] = mask;
        return mask;
    }

    placeCast(image, spec) {
        if (!image || !spec) return;
        image.setTexture(spec.key);
        P.applyOrigin(image, spec);
        image.setPosition(spec.loc[0], spec.loc[1]);
        image.setVisible(true);
    }

    showScoreBanner(levelIndex) {
        const level = levelIndex + 1;
        this.scoreBannerDigit.setVisible(false);
        this.levelText.setVisible(false);
        if (level === 1 && this.textures.exists(P.CAST.title.key)) {
            this.placeCast(this.scoreBanner, P.CAST.title);
            return;
        }
        if (level === 10 && this.textures.exists(P.CAST.bonusRound.key)) {
            this.placeCast(this.scoreBanner, P.CAST.bonusRound);
            return;
        }
        if (this.textures.exists(P.CAST.levelWord.key)) {
            this.placeCast(this.scoreBanner, P.CAST.levelWord);
            const digit = P.CAST.levelDigit[level];
            if (digit && this.textures.exists(digit.key)) {
                this.placeCast(this.scoreBannerDigit, digit);
            } else {
                this.levelText.setText(String(level));
                this.levelText.setStyle({ fontSize: '22px', fontFamily: 'Arial, sans-serif' });
                this.levelText.setPosition(326, 160).setAlpha(1).setVisible(true);
            }
            return;
        }
        this.levelText.setText(level === 10 ? 'Bonus Round' : ('LEVEL ' + level));
        this.levelText.setStyle({ fontSize: '40px', fontFamily: 'Arial, sans-serif' });
        this.levelText.setPosition(STAGE_W / 2, STAGE_H / 2).setAlpha(1).setVisible(true);
    }

    hideScoreBanner() {
        if (this.scoreBanner) this.scoreBanner.setVisible(false);
        if (this.scoreBannerDigit) this.scoreBannerDigit.setVisible(false);
    }

    unlockGameAudio() {
        if (this.audio) this.audio.unlock();
        if (this.sound && this.sound.unlock) this.sound.unlock();
        if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume();
        }
    }

    playOriginalEvent(eventKey, extra) {
        this.unlockGameAudio();
        if (!this.audio) return false;
        return this.audio.playEvent(eventKey, extra || {});
    }

    // Original nextLevel / ridicule: repeat while soundBusy(1).
    whenSfxIdle(fn) {
        if (this.audio && this.audio.whenIdle) {
            this.audio.whenIdle(fn, (cb) => this.time.delayedCall(50, cb));
            return;
        }
        fn();
    }

    setKidMember(kid, name, variant) {
        const spec = P.kidMember(name, variant || 0);
        if (!spec || !kid.bodySprite) return;
        kid.bodySprite.setTexture(spec.key);
        P.applyOrigin(kid.bodySprite, spec);
        kid.memberName = spec.name;
        kid.memberSpec = spec;
    }

    showKidFrame(kid, atlasFrame, variant) {
        const team = kid.teamType === 'player' ? 'player' : 'cpu';
        const map = {
            idle_0: { player: ['R ready', 0], cpu: ['G ready', 0] },
            walking: { player: ['R Auto walk_1', 0], cpu: ['G Walk V1', 0] },
            walkingAlt: { player: ['R Auto walk_2', 0], cpu: ['G Walk V2', 0] },
            throw_0: { player: ['R cock', 0], cpu: ['G windup', 0] },
            throw_1: { player: ['R toss', 0], cpu: ['G cock', 0] },
            throw_2: { player: ['R toss', 0], cpu: ['G toss', 0] },
            hit_0: { player: ['R hit', 0], cpu: ['G Hit', 0] },
            hit_1: { player: ['R daze1', 0], cpu: ['G Hit', 0] },
            hit_2: { player: ['R daze2', 0], cpu: ['G Hit2', 0] },
            hit_3: { player: ['R daze3', 0], cpu: ['G Hit2', 0] },
            death_0: { player: ['R dead', 0], cpu: ['G dead', 0] },
            hardDeath: { player: ['R dead', 1], cpu: ['G dead', 1] },
            wipedOut: { player: ['R dead', 2], cpu: ['G dead', 2] },
            minorDeath: { player: ['R dead', 0], cpu: ['G dead', 3] },
            stunned: { player: ['R daze1', 0], cpu: ['G down', 0] },
            guard: { player: ['R ready', 0], cpu: ['G recover', 0] },
            brushOff: { player: ['R ready', 0], cpu: ['G ow', 0] }
        };
        const pair = map[atlasFrame] && map[atlasFrame][team];
        if (!pair) return;
        this.setKidMember(kid, pair[0], variant != null ? variant : pair[1]);
    }

    showKidIdle(kid) {
        this.setKidMember(kid, kid.teamType === 'player' ? 'R ready' : 'G ready');
    }

    showKidVictory(kid) {
        const frames = P.kidMembersNamed('G yea');
        if (!frames.length) return;
        let i = 0;
        this.setKidMember(kid, 'G yea', 0);
        kid.victoryTimer = this.time.addEvent({
            delay: 250, loop: true,
            callback: () => {
                i = (i + 1) % frames.length;
                this.setKidMember(kid, 'G yea', i);
            }
        });
    }

    // Title: original waits for rollover(1). Browsers need a click to unlock audio.
    showTitle() {
        this.awaitingTitleClick = true;
        this.showScoreBanner(0);
        this.subText.setText('Click to play').setVisible(true);
    }

    startLevel(index) {
        this.currentLevelIndex = index;
        this.killsThisLevel = 0;
        const layout = P.LEVELS[index];
        const isFirst = (index === 0);

        if (isFirst && this.audio) {
            this.audio.playIntro();
            this.audio.startMusic();
        }

        this.awaitingTitleClick = false;
        this.stopAI();
        this.hideScoreBanner();
        if (this.subText) this.subText.setVisible(false);
        [...this.greenTeam, ...this.redTeam].forEach(k => this.destroyKid(k));
        this.greenTeam = [];
        this.redTeam = [];
        this.projectiles.forEach(ball => this.destroyBall(ball));
        this.projectiles = [];
        this.ballClock = 0;
        if (this.isDragging) this.cancelDrag();
        this.hideSelectionUI();
        this.hoveredPlayer = null;

        this.isLevelActive = false;
        this.walkingCount = 0;
        this.textFadeComplete = false;

        this.createTeam('player', this.redTeam, layout.reds);
        this.createTeam('cpu', this.greenTeam, layout.greens);

        this.showScoreBanner(index);
        this.playScoreBanner(index);
    }

    clearScoreBannerAnims() {
        this._bannerGen = (this._bannerGen || 0) + 1;
        if (this.tweens) {
            this.tweens.killTweensOf(this.scoreBanner);
            this.tweens.killTweensOf(this.scoreBannerDigit);
            this.tweens.killTweensOf(this.levelText);
            if (this.greetingText) this.tweens.killTweensOf(this.greetingText);
        }
        if (this._bannerHold) {
            this._bannerHold.remove(false);
            this._bannerHold = null;
        }
    }

    playScoreBanner(index) {
        this.clearScoreBannerAnims();
        const timing = P.bannerTiming(index + 1);
        const gen = this._bannerGen;
        const targets = [this.scoreBanner, this.scoreBannerDigit, this.levelText].filter((t) => t && t.visible);
        const finish = () => {
            if (gen !== this._bannerGen) return;
            this.hideScoreBanner();
            this.levelText.setVisible(false);
            this.textFadeComplete = true;
            this.checkLevelReady();
        };
        if (!targets.length) {
            finish();
            return;
        }
        const fadeInMs = P.framesToMs(timing.fadeIn, timing.fps);
        const holdMs = P.framesToMs(timing.hold, timing.fps);
        const fadeOutMs = P.framesToMs(timing.fadeOut, timing.fps);
        targets.forEach((t) => { t.alpha = fadeInMs ? 0 : 1; });
        const fadeOut = () => {
            if (gen !== this._bannerGen) return;
            this.tweens.add({
                targets: targets,
                alpha: 0,
                duration: Math.max(1, fadeOutMs),
                onComplete: finish
            });
        };
        const afterIn = () => {
            if (gen !== this._bannerGen) return;
            if (holdMs) this._bannerHold = this.time.delayedCall(holdMs, fadeOut);
            else fadeOut();
        };
        if (fadeInMs) {
            this.tweens.add({
                targets: targets,
                alpha: 1,
                duration: fadeInMs,
                onComplete: afterIn
            });
        } else {
            afterIn();
        }
    }

    jumpToLevel(index) {
        if (index < 0 || index >= RULES.greensPerLevel.length) return;
        this.clearScoreBannerAnims();
        this.hideEndScreen();
        this.startLevel(index);
    }

    checkLevelReady() {
        if (this.isLevelActive) return;
        if (this.textFadeComplete && this.walkingCount === 0) {
            this.isLevelActive = true;
            this.greenTeam.forEach(g => this.setReady(g));
            this.aiTimer = this.time.addEvent({ delay: RULES.aiTickMs, loop: true, callback: () => this.aiTick() });
        }
    }

    createTeam(type, teamArray, positions) {
        const pack = this.walkon[this.currentLevelIndex] || null;
        const paths = pack ? (type === 'player' ? pack.reds : pack.greens) : [];
        const readyName = type === 'player' ? 'R ready' : 'G ready';
        const shadowSpec = P.kidMember('shadow');
        const readySpec = P.kidMember(readyName);

        for (let i = 0; i < positions.length; i++) {
            const finalPos = positions[i];
            const path = paths[i] && paths[i].length ? paths[i] : null;
            const spawnX = path ? path[0].x : finalPos.x;
            const spawnY = path ? path[0].y : finalPos.y;

            let kid = this.add.container(spawnX, spawnY);
            let shadow = this.add.image(spawnX, spawnY, shadowSpec ? shadowSpec.key : 'shadow');
            if (shadowSpec) P.applyOrigin(shadow, shadowSpec);
            shadow.setDepth(-5);
            this.shadowGroup.add(shadow);

            let sprite = this.add.image(0, 0, readySpec ? readySpec.key : 'red_team_atlas');
            kid.add(sprite);
            kid.isAlive = true;
            kid.teamType = type;
            kid.bodySprite = sprite;
            kid.shadow = shadow;
            kid.hits = 0;
            kid.isDazed = false;   // red: hit once, can't be grabbed, still hittable
            kid.isImmune = false;  // green: knocked down
            kid.ai = 'walkon';
            kid.actionTimers = [];
            this.setKidMember(kid, path ? path[0].member : readyName);

            if (DEBUG_MODE) {
                kid.debugLabel = this.makeText(0, -45, '', {
                    fontSize: '10px', color: '#000000', backgroundColor: '#ffffff', padding: { x: 2, y: 1 }
                }).setOrigin(0.5).setDepth(1000);
            }

            teamArray.push(kid);
            kid.finalX = finalPos.x;
            kid.finalY = finalPos.y;
            kid.myDirection = { x: 0, y: 0 };

            if (!path || path.length < 2) {
                kid.isWalkingOntoField = false;
                kid.ai = 'ready';
                this.showKidIdle(kid);
                continue;
            }

            kid.isWalkingOntoField = true;
            this.walkingCount++;
            let step = 0;
            const fps = P.scoreTempoFps(this.currentLevelIndex + 1);
            kid.walkTimer = this.time.addEvent({
                delay: 1000 / fps,
                loop: true,
                callback: () => {
                    step += 1;
                    if (step >= path.length) {
                        kid.x = kid.finalX;
                        kid.y = kid.finalY;
                        kid.isWalkingOntoField = false;
                        this.setKidMember(kid, type === 'player' ? 'R rest' : 'G ready');
                        kid.walkTimer.remove();
                        kid.walkTimer = null;
                        this.walkingCount--;
                        this.checkLevelReady();
                        return;
                    }
                    kid.x = path[step].x;
                    kid.y = path[step].y;
                    this.setKidMember(kid, path[step].member);
                    this.stepSound();
                }
            });
        }
    }

    stepSound() {
        if (this.time.now - this.lastStepSound > 250) {
            this.lastStepSound = this.time.now;
            this.playOriginalEvent('walk_step');
        }
    }

    currentPower() {
        const steps = Math.floor((this.time.now - this.pressTime) / RULES.powerTickMs);
        return Phaser.Math.Clamp(steps, 0, RULES.maxPower);
    }

    update(time, delta) {
        if (this.isDragging && this.activePlayer) {
            this.activePower = this.currentPower();
            this.updatePowerMeter();
            this.updateSelectionUI(this.activePlayer);
        }

        [...this.redTeam, ...this.greenTeam].forEach(kid => {
            if (kid.shadow && !kid.shadowLocked && kid.isAlive) kid.shadow.setPosition(kid.x, kid.y);
            if (DEBUG_MODE && kid.debugLabel) {
                const labelY = (kid.y - 45 < 10) ? kid.y + 35 : kid.y - 45;
                kid.debugLabel.setPosition(kid.x, labelY);
                kid.debugLabel.setText(`${Math.round(kid.x)}, ${Math.round(kid.y)}`);
                kid.debugLabel.setVisible(kid.isAlive);
            }
        });

        this.updateBalls(delta);
    }

    // --- SNOWBALLS ---
    // Discrete Director ticks: loc += (±20,±10) while myRange > 0, then 4 drop
    // frames of (±10,±5), splat, 4 melt frames. Hits only on fly steps after the
    // range decrement while myRange is still > 0. Height is baked into the BITD.

    teamBallCount(team) {
        return this.projectiles.filter(b => b.team === team && b.phase !== 'melt' && b.phase !== 'splat').length;
    }

    throwSnowball(thrower, power) {
        const team = thrower.teamType;

        this.showKidFrame(thrower, team === 'player' ? 'throw_1' : 'throw_2');
        if (team === 'player') {
            this.time.delayedCall(100, () => {
                if (thrower.isAlive && !thrower.isDazed) this.showKidIdle(thrower);
            });
        }

        if (this.teamBallCount(team) >= RULES.maxBallsPerTeam) return;

        const gx = thrower.x;
        const gy = thrower.y;
        const spec = P.CAST.snowball;
        const ball = this.add.image(gx, gy, spec.key).setDepth(60);
        P.applyOrigin(ball, spec);

        this.projectiles.push({
            team,
            ball,
            gx, gy,
            range: P.throwRangeSteps(power),
            phase: 'fly',
            frame: 0,
            flyStep: P.ballStepForTeam(team),
            dropStep: P.dropStepForTeam(team)
        });

        this.playOriginalEvent('throw', { power });
    }

    setBallFrame(b) {
        const spec = P.ballFrame(b.phase, b.frame);
        if (this.textures.exists(spec.key)) {
            b.ball.setTexture(spec.key);
            P.applyOrigin(b.ball, spec);
        }
        b.ball.setPosition(Math.round(b.gx), Math.round(b.gy));
    }

    updateBalls(deltaMs) {
        this.ballClock += deltaMs;
        while (this.ballClock >= RULES.ballTickMs) {
            this.ballClock -= RULES.ballTickMs;
            this.stepBalls();
        }
    }

    stepBalls() {
        const done = [];
        for (const b of this.projectiles) {
            if (b.phase === 'fly') {
                b.gx += b.flyStep.x;
                b.gy += b.flyStep.y;
                b.range -= 1;
                this.setBallFrame(b);
                if (b.range > 0 && this.isLevelActive) {
                    const targets = (b.team === 'player') ? this.greenTeam : this.redTeam;
                    const ballCast = P.CAST.snowball;
                    const ballMask = this.matteFor(ballCast.key);
                    const hit = targets.find(k => {
                        if (!k.isAlive || k.isImmune) return false;
                        const spec = k.memberSpec || P.kidMember(k.teamType === 'player' ? 'R ready' : 'G ready');
                        const kidMask = this.matteFor(spec.key);
                        if (ballMask && kidMask) {
                            return P.mattesOverlap(b.gx, b.gy, ballCast, ballMask, k.x, k.y, spec, kidMask);
                        }
                        return P.rectsOverlap(P.memberRect(b.gx, b.gy, ballCast), P.memberRect(k.x, k.y, spec));
                    });
                    if (hit) {
                        this.handleHit(hit);
                        done.push(b);
                        continue;
                    }
                } else {
                    b.phase = 'drop';
                    b.frame = 0;
                    this.setBallFrame(b);
                }
            } else if (b.phase === 'drop') {
                b.gx += b.dropStep.x;
                b.gy += b.dropStep.y;
                b.frame += 1;
                if (b.frame >= P.DROP_STEPS) {
                    b.phase = 'splat';
                    b.frame = 0;
                    this.playOriginalEvent('ground_land');
                }
                this.setBallFrame(b);
            } else if (b.phase === 'splat') {
                b.phase = 'melt';
                b.frame = 0;
                this.setBallFrame(b);
            } else if (b.phase === 'melt') {
                b.frame += 1;
                if (b.frame >= P.MELT_STEPS) {
                    done.push(b);
                    continue;
                }
                this.setBallFrame(b);
            } else {
                const neverPhase = b.phase;
                void neverPhase;
                done.push(b);
            }

            if (b.gx < -80 || b.gx > STAGE_W + 80 || b.gy < -80 || b.gy > STAGE_H + 80) {
                if (!done.includes(b)) done.push(b);
            }
        }
        if (done.length) {
            done.forEach(b => this.destroyBall(b));
            this.projectiles = this.projectiles.filter(b => !done.includes(b));
        }
    }

    destroyBall(b) {
        if (b.ball) b.ball.destroy();
        if (b.shadow) b.shadow.destroy();
    }

    // --- HITS ---

    handleHit(kid) {
        if (!this.isLevelActive) return;
        if (!kid.isAlive || kid.isImmune) return;
        kid.hits++;
        this.playOriginalEvent('person_impact');
        if (kid.teamType === 'player') this.hitRed(kid);
        else this.hitGreen(kid);
    }

    hitRed(kid) {
        if (kid === this.activePlayer) this.cancelDrag();
        if (kid === this.hoveredPlayer) {
            this.hideSelectionUI();
            this.hoveredPlayer = null;
        }
        this.stopDaze(kid);

        if (kid.hits >= RULES.redHitsToKO) {
            this.playOriginalEvent('red_death');
            this.knockOut(kid, 'death_0');
            return;
        }

        // Dazed: can't be grabbed, can still be hit
        this.playOriginalEvent('red_stun');
        kid.isDazed = true;
        this.showKidFrame(kid, 'hit_0');
        const cycle = ['hit_1', 'hit_2', 'hit_3'];
        let i = 0;
        kid.dazeTimer = this.time.addEvent({
            delay: RULES.aiTickMs, loop: true,
            callback: () => this.showKidFrame(kid, cycle[i++ % cycle.length])
        });
        kid.dazeEnd = this.time.delayedCall(RULES.redDazeMs, () => {
            this.stopDaze(kid);
            if (kid.isAlive) this.showKidIdle(kid);
        });
    }

    stopDaze(kid) {
        if (kid.dazeTimer) kid.dazeTimer.remove();
        if (kid.dazeEnd) kid.dazeEnd.remove();
        kid.dazeTimer = kid.dazeEnd = null;
        kid.isDazed = false;
    }

    reviveRed(kid) {
        if (kid.isAlive) return;
        kid.isAlive = true;
        // Original `z`: revived reds keep myHits ≥ 2, so the exact `myHits = 2`
        // death check never fires again. Remake: immune so they can't be hit again.
        kid.hits = RULES.redHitsToKO;
        kid.isImmune = true;
        kid.setAlpha(1);
        this.showKidIdle(kid);
    }

    hitGreen(kid) {
        this.cancelActions(kid);
        kid.ai = 'hurt';
        const hp = RULES.greenHitsToKO[GAME_DIFFICULTY] || 3;

        if (kid.hits >= hp) {
            this.playOriginalEvent('green_death');
            this.killsThisLevel++;
            this.knockOut(kid, Phaser.Utils.Array.GetRandom(['death_0', 'hardDeath', 'wipedOut', 'minorDeath']));
            return;
        }

        if (kid.hits === hp - 1) {
            // Knocked down: immune until back on their feet
            this.playOriginalEvent('green_second_hit');
            kid.isImmune = true;
            this.showKidFrame(kid, 'stunned');
            this.queueAction(kid, RULES.greenDownMs, () => {
                kid.isImmune = false;
                this.showKidFrame(kid, 'guard');
            }, true);
            this.queueAction(kid, RULES.greenDownMs + RULES.greenRecoverMs, () => this.showKidFrame(kid, 'brushOff'), true);
            this.queueAction(kid, RULES.greenDownMs + RULES.greenRecoverMs * 2, () => this.setReady(kid), true);
        } else {
            this.showKidFrame(kid, 'hit_0');
            this.queueAction(kid, RULES.greenOwMs, () => this.showKidFrame(kid, 'brushOff'), true);
            this.queueAction(kid, RULES.greenOwMs + RULES.greenRecoverMs, () => this.setReady(kid), true);
        }
    }

    knockOut(kid, frame) {
        kid.isAlive = false;
        kid.isImmune = false;
        kid.isDazed = false;
        this.cancelActions(kid);
        this.showKidFrame(kid, frame);
        if (kid.walkTimer) kid.walkTimer.remove();
        this.checkWinCondition();
    }

    // --- ENEMY AI ---
    // Every 100 ms each ready green rolls: 10% walk along the throw axis then throw,
    // 10% side-step, 20% throw, 60% stand still. Greens never aim.

    setReady(kid) {
        if (!kid.isAlive) return;
        kid.ai = 'ready';
        this.showKidIdle(kid);
    }

    stopAI() {
        if (this.aiTimer) this.aiTimer.remove();
        this.aiTimer = null;
    }

    aiTick() {
        if (!this.isLevelActive) return;
        this.greenTeam.forEach(kid => {
            if (!kid.isAlive) return;
            if (kid.ai === 'ready') {
                const roll = Phaser.Math.Between(1, 10);
                if (roll === 1) {
                    kid.ai = 'walk';
                    kid.stepsLeft = Phaser.Math.Between(1, 99);
                    kid.myDirection = P.walkAxisDirection(Phaser.Math.RND.sign());
                } else if (roll === 2) {
                    kid.ai = 'side';
                    kid.stepsLeft = 5;
                    kid.myDirection = P.sideStepDirection(Phaser.Math.RND.sign());
                } else if (roll <= 4) {
                    this.startGreenThrow(kid);
                }
            } else if (kid.ai === 'walk' || kid.ai === 'side') {
                this.stepGreen(kid);
            }
        });
    }

    stepGreen(kid) {
        let dir = kid.myDirection || { x: 0, y: 0 };
        if (kid.ai === 'walk') {
            dir = P.edgeSteer(kid.x, kid.y, dir);
            kid.myDirection = dir;
        }
        const nx = kid.x + dir.x;
        const ny = kid.y + dir.y;

        if (P.onRedSide(nx, ny)) {
            this.startGreenThrow(kid);
            return;
        }
        kid.x = nx;
        kid.y = ny;
        const flip = kid.stepsLeft % 2;
        if (kid.ai === 'side') this.setKidMember(kid, flip ? 'G Walk H1' : 'G Walk H2');
        else this.setKidMember(kid, flip ? 'G Walk V1' : 'G Walk V2');
        if (kid.ai === 'walk') this.stepSound();

        kid.stepsLeft--;
        if (kid.stepsLeft <= 0) {
            if (kid.ai === 'walk') this.startGreenThrow(kid);
            else this.setReady(kid);
        }
    }

    startGreenThrow(kid) {
        if (this.teamBallCount('cpu') >= RULES.maxBallsPerTeam) {
            this.setReady(kid);
            return;
        }
        kid.ai = 'throw';
        this.showKidFrame(kid, 'throw_0');
        const cock = Phaser.Math.Between(RULES.cockMs[0], RULES.cockMs[1]);
        const release = RULES.windupMs + cock;
        this.queueAction(kid, RULES.windupMs, () => this.showKidFrame(kid, 'throw_1'));
        this.queueAction(kid, release, () => {
            const power = Phaser.Math.Between(RULES.greenThrowPower[0], RULES.greenThrowPower[1]);
            this.throwSnowball(kid, power);
        });
        this.queueAction(kid, release + RULES.tossMs, () => this.setReady(kid));
    }

    // Delayed action owned by a kid; dropped if the kid is hit, dies, or the level ends
    queueAction(kid, delay, fn, evenIfHurt = false) {
        const timer = this.time.delayedCall(delay, () => {
            kid.actionTimers = kid.actionTimers.filter(t => t !== timer);
            if (kid.isAlive && this.isLevelActive && (evenIfHurt || kid.ai !== 'hurt')) fn();
        });
        kid.actionTimers.push(timer);
    }

    cancelActions(kid) {
        (kid.actionTimers || []).forEach(t => t.remove());
        kid.actionTimers = [];
        if (kid.victoryTimer) {
            kid.victoryTimer.remove();
            kid.victoryTimer = null;
        }
    }

    // --- LEVEL FLOW & SCORE ---

    checkWinCondition() {
        if (!this.isLevelActive) return;
        const greenAlive = this.greenTeam.some(k => k.isAlive);
        const redAlive = this.redTeam.some(k => k.isAlive);
        if (greenAlive && redAlive) return;

        this.isLevelActive = false;
        this.stopAI();
        if (this.isDragging) this.cancelDrag();
        this.hideSelectionUI();
        [...this.redTeam, ...this.greenTeam].forEach(k => {
            this.cancelActions(k);
            if (k.isAlive && k.teamType === 'player') {
                this.stopDaze(k);
                this.showKidIdle(k);
            }
        });

        if (!greenAlive) this.levelCleared();
        else this.levelLost();
    }

    levelCleared() {
        this.score += this.greenTeam.length;
        const isLast = this.currentLevelIndex >= RULES.greensPerLevel.length - 1;
        const pointerX = this.input.activePointer ? this.input.activePointer.worldX : 300;
        // nextLevel waits while soundBusy(1) so the last kids cue finishes, then
        // ugly/halaluja by mouseH < 280.
        this.whenSfxIdle(() => {
            this.playOriginalEvent('level_clear', { mouseH: pointerX });
            this.whenSfxIdle(() => {
                if (isLast) this.victory();
                else this.startLevel(this.currentLevelIndex + 1);
            });
        });
    }

    levelLost() {
        this.score = (this.score + this.killsThisLevel) * (this.currentLevelIndex + 1);
        this.greenTeam.forEach(k => { if (k.isAlive) this.showKidVictory(k); });

        // ridicule() twice: each laugh waits for soundBusy(1) before the next.
        this.whenSfxIdle(() => {
            this.playOriginalEvent('game_over');
            this.whenSfxIdle(() => {
                this.playOriginalEvent('game_over');
                this.whenSfxIdle(() => this.showLossScreen());
            });
        });

        const fallen = [...this.redTeam, ...this.greenTeam].filter(k => !k.isAlive);
        this.tweens.add({ targets: fallen, alpha: 0, duration: 1500, delay: 1000 });
        this.tweens.add({ targets: fallen.map(k => k.shadow), alpha: 0, duration: 1500, delay: 1000 });
    }

    victory() {
        this.score = this.score * 10;
        if (this.score > 900) this.score = 1000;
        this.showVictoryScreen();
    }

    showLossScreen() {
        this.clearScoreBannerAnims();
        this.hideScoreBanner();
        this.levelText.setVisible(false);
        this.greetingText.setAlpha(1).setVisible(true);
        this.revealPlayAgain('loss');
    }

    showVictoryScreen() {
        this.clearScoreBannerAnims();
        this.hideScoreBanner();
        this.levelText.setVisible(false);
        if (!this.textures.exists(P.CAST.congrats.key)) {
            this.levelText.setText('YOU WIN!');
            this.levelText.setStyle({ fontSize: '60px', fontFamily: 'Arial, sans-serif' });
            this.levelText.setPosition(STAGE_W / 2, STAGE_H / 2 - 20).setAlpha(1).setVisible(true);
            this.revealPlayAgain('victory');
            return;
        }
        const c = P.SCORE_UI.congrats;
        const gen = this._bannerGen;
        this.placeCast(this.scoreBanner, P.CAST.congrats);
        this.scoreBanner.setAlpha(0).setVisible(true);
        this.tweens.add({
            targets: this.scoreBanner,
            alpha: 1,
            duration: P.framesToMs(c.fadeIn, c.fps),
            onComplete: () => {
                if (gen !== this._bannerGen) return;
                this._bannerHold = this.time.delayedCall(P.framesToMs(c.hold, c.fps), () => {
                    if (gen !== this._bannerGen) return;
                    this.tweens.add({
                        targets: this.scoreBanner,
                        alpha: 0,
                        duration: P.framesToMs(c.fadeOut, c.fps),
                        onComplete: () => {
                            if (gen !== this._bannerGen) return;
                            this.fadeInVictoryLogo();
                        }
                    });
                });
            }
        });
    }

    fadeInVictoryLogo() {
        const timing = P.SCORE_UI.logoVictory;
        const gen = this._bannerGen;
        this.greetingText.setAlpha(0).setVisible(true);
        this.tweens.add({
            targets: this.greetingText,
            alpha: 1,
            duration: P.framesToMs(timing.fadeIn, timing.fps),
            onComplete: () => {
                if (gen !== this._bannerGen) return;
                this.revealPlayAgain('victory');
            }
        });
    }

    revealPlayAgain(kind) {
        const spec = P.CAST.playAgain;
        if (this.textures.exists(spec.key)) {
            const loc = kind === 'victory' ? spec.victoryLoc : spec.loc;
            this.placeCast(this.playAgainButton, Object.assign({}, spec, { loc: loc }));
        } else {
            this.playAgainButton.setVisible(true);
        }
        this.playAgainButton.setAlpha(0);
        const fadeMs = P.framesToMs(P.SCORE_UI.playAgain.fadeIn, P.SCORE_UI.playAgain.fps);
        this.tweens.add({ targets: this.playAgainButton, alpha: 1, duration: fadeMs });
        if (this.score > 0) {
            const counter = { n: 0 };
            this.scoreText.setVisible(true).setText('SCORE: 0');
            this.tweens.add({
                targets: counter, n: this.score, duration: Math.min(2000, 200 + this.score * 4),
                onUpdate: () => this.scoreText.setText('SCORE: ' + Math.round(counter.n))
            });
        }
    }

    hideEndScreen() {
        this.clearScoreBannerAnims();
        this.playAgainButton.setVisible(false);
        this.scoreText.setVisible(false);
        this.hideScoreBanner();
        if (this.levelText) this.levelText.setVisible(false);
        if (this.greetingText) this.greetingText.setVisible(false);
    }

    destroyKid(k) {
        this.cancelActions(k);
        this.stopDaze(k);
        if (k.walkTimer) k.walkTimer.remove();
        if (k.shadow) k.shadow.destroy();
        if (k.debugLabel) k.debugLabel.destroy();
        k.destroy();
    }

    cancelDrag() {
        if (this.activePlayer) this.activePlayer.shadowLocked = false;
        this.hidePowerMeter();
        this.hideSelectionUI();
        this.isDragging = false;
        this.activePower = 0;
        this.hoveredPlayer = null;
        this.activePlayer = null;
    }

    // Exact hit first; otherwise the closest grabbable kid within radius (touch).
    kidNear(team, x, y, radius) {
        const exact = this.kidAt(team, x, y);
        if (exact) return exact;
        let best = null, bestD = radius;
        team.forEach((kid) => {
            if (!kid.isAlive || kid.isWalkingOntoField) return;
            const d = Phaser.Math.Distance.Between(x, y, kid.x, kid.y - 14);
            if (d <= bestD) { best = kid; bestD = d; }
        });
        return best;
    }

    kidAt(team, x, y) {
        return team.find((kid) => {
            if (!kid.isAlive || kid.isWalkingOntoField) return false;
            const spec = kid.memberSpec || P.kidMember('R ready');
            const box = P.memberRect(kid.x, kid.y, spec);
            return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
        }) || null;
    }

    showSelectionUI(player) {
        this.selectionCircle.clear();
        this.selectionCircle.lineStyle(2, 0x0088cc, 1);
        this.selectionCircle.strokeEllipse(0, 0, 60, 30);
        this.selectionCircle.setPosition(player.x, player.y);
        this.selectionCircle.setVisible(true);
        if (!this.isDragging) this.activePower = 0;
        this.powerMeter.setVisible(true);
        this.updatePowerMeter();
    }

    showPowerMeter(player) {
        this.powerMeter.setVisible(true);
        this.updatePowerMeter();
        this.updateSelectionUI(player);
    }

    updateSelectionUI(player) {
        if (!player) return;
        this.selectionCircle.setPosition(player.x, player.y);
        if (this.powerMeter.visible) {
            const spec = P.CAST.power[this.activePower] || P.CAST.power[0];
            this.powerMeter.setTexture(spec.key);
            P.applyOrigin(this.powerMeter, spec);
            this.powerMeter.setPosition(player.x, player.y);
        }
    }

    hideSelectionUI() {
        this.selectionCircle.setVisible(false);
        this.powerMeter.setVisible(false);
    }

    hidePowerMeter() {
        this.powerMeter.setVisible(false);
    }

    updatePowerMeter() {
        if (!this.powerMeter.visible) return;
        const spec = P.CAST.power[this.activePower] || P.CAST.power[0];
        this.powerMeter.setTexture(spec.key);
        P.applyOrigin(this.powerMeter, spec);
        if (this.activePlayer) {
            this.powerMeter.setPosition(this.activePlayer.x, this.activePlayer.y);
        }
    }
}

game = new Phaser.Game(getConfig());

(function initPhoneUi() {
    const fs = document.getElementById('fullscreen-btn');
    if (fs && document.fullscreenEnabled) fs.hidden = false;
    updateRotateHint();
})();

(function restoreMuteUi() {
    const box = document.getElementById('mute-checkbox');
    if (!box) return;
    try {
        box.checked = localStorage.getItem('snowcraft-muted') === '1';
    } catch (err) {
        box.checked = false;
    }
})();

window.SnowcraftGame = {
    RULES,
    STAGE_W,
    STAGE_H,
    DISPLAY_BASE_W,
    DISPLAY_BASE_H,
    getScale: function () { return GAME_SCALE; },
    computeLayout,
    getGame: function () { return game; },
    getScene: function () {
        return game && game.scene && game.scene.scenes ? game.scene.scenes[0] : null;
    },
    getAudio: function () { return snowcraftAudio; },
    parity: P
};
