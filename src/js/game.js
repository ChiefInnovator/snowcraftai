// --- CONFIGURATION ---
const PARAMS = new URLSearchParams(location.search);
const DEBUG_MODE = PARAMS.has('debug'); // ?debug → coordinate labels + level-jump keys (1-9, 0, z)
const START_LEVEL = 1; // Level to start on (1-10)
let GAME_SCALE = 0; // 0 = fit the window; otherwise a fixed multiple of 600x320
let GAME_DIFFICULTY = 2; // 1=Easy, 2=Normal, 3=Hard
let game = null;

const STAGE_W = 600;
const STAGE_H = 320;

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
    redDazeMs: 4500,
    greenOwMs: 1000,
    greenRecoverMs: 500,
    greenDownMs: 2500,         // the only immune state
    aiTickMs: P.TICK_MS * (P.CHAR_TEMPO_TICKS + 1), // 100 ms
    greenThrowPower: [5, 8],
    windupMs: 500,
    cockMs: [600, 1500],
    tossMs: 500,
};

function computeLayout() {
    let width;
    if (GAME_SCALE > 0) {
        width = STAGE_W * GAME_SCALE;
    } else {
        const reservedH = 230; // options bar + instructions
        width = Math.min(window.innerWidth - 40, (window.innerHeight - reservedH) * STAGE_W / STAGE_H);
        width = Math.max(300, Math.floor(width));
    }
    const height = Math.round(width * STAGE_H / STAGE_W);
    // Render at the displayed pixel density so text and vector UI stay sharp on HiDPI screens
    const renderScale = Phaser.Math.Clamp(Math.ceil((width / STAGE_W) * (window.devicePixelRatio || 1)), 1, 4);
    return { width, height, renderScale };
}

function sizeContainer(layout) {
    const el = document.getElementById('game-container');
    el.style.width = layout.width + 'px';
    el.style.height = layout.height + 'px';
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

window.addEventListener('resize', () => {
    if (GAME_SCALE === 0 && game) sizeContainer(computeLayout());
});

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

const SFX = ['throw', 'throw_full', 'hit', 'splat', 'knockdown', 'green_out', 'red_daze', 'red_out',
             'deny', 'step', 'cheer', 'level_clear', 'victory', 'level_start'];

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // --- ASSET LOADING ---
        this.load.image('red_team_atlas', 'assets/player.png');
        this.load.image('green_team_atlas', 'assets/enemy.png');
        this.load.image('snowball', 'assets/snowball.png');
        this.load.image('splash', 'assets/splash.png');
        this.load.image('sink', 'assets/sink.png');
        this.load.image('puddle', 'assets/puddle.png');
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
        this.load.image('shadow', 'assets/shadow.png');
        this.load.image('snowball_shadow', 'assets/snowball_shadow.png');
        this.load.image('hand', 'assets/smallHand.png');

        // Audio
        SFX.forEach(name => this.load.audio('sfx_' + name, 'assets/sfx/' + name + '.wav'));
        this.load.audio('sfx_intro', 'assets/intro.mp3');
        this.load.audio('music', 'assets/musicAlt.mp3');
    }

    create(data) {
        this.renderScale = this.registry.get('renderScale') || 1;
        this.cameras.main.setZoom(this.renderScale).centerOn(STAGE_W / 2, STAGE_H / 2);

        // 1. Environment
        let bg = this.add.graphics();
        bg.fillGradientStyle(0xddeeff, 0xddeeff, 0xffffff, 0xffffff, 1);
        bg.fillRect(0, 0, STAGE_W, STAGE_H);
        bg.setDepth(-10);

        if (DEBUG_MODE) {
            let debugLine = this.add.graphics();
            debugLine.lineStyle(2, 0xff0000, 1);
            debugLine.lineBetween(0, STAGE_H, 648, 0);
            debugLine.setDepth(100);
        }

        if (this.textures.exists('playfield')) {
            let pf = this.add.image(STAGE_W / 2, STAGE_H / 2, 'playfield');
            pf.setDisplaySize(STAGE_W, STAGE_H);
            pf.setDepth(-5);
        }

        // 2. Define Frames & Animations (skipped on restart: textures/anims are global)
        const redTex = this.textures.get('red_team_atlas');
        if (!redTex.has('idle_0')) {
            redTex.add('idle_0', 0, 148, 19, 26, 34);
            redTex.add('walking', 0, 15, 19, 24, 34);
            redTex.add('walkingAlt', 0, 59, 18, 30, 35);
            redTex.add('throw_0', 0, 84, 99, 31, 35);
            redTex.add('throw_1', 0, 150, 98, 23, 36);
            redTex.add('hit_0', 0, 199, 24, 35, 30);
            redTex.add('hit_1', 0, 258, 11, 32, 43);
            redTex.add('hit_2', 0, 312, 10, 36, 44);
            redTex.add('hit_3', 0, 368, 13, 35, 40);
            redTex.add('death_0', 0, 208, 109, 71, 32);
            redTex.add('hardDeath', 0, 290, 101, 68, 48);
            redTex.add('wipedOut', 0, 376, 98, 51, 53);
        }

        const greenTex = this.textures.get('green_team_atlas');
        if (!greenTex.has('idle_0')) {
            greenTex.add('idle_0', 0, 133, 18, 30, 36);
            greenTex.add('idle_1', 0, 186, 18, 27, 34);
            greenTex.add('walking', 0, 133, 18, 30, 36);
            greenTex.add('walkingAlt', 0, 186, 18, 27, 34);
            greenTex.add('throw_0', 0, 292, 23, 24, 31);
            greenTex.add('throw_1', 0, 332, 19, 34, 35);
            greenTex.add('throw_2', 0, 393, 20, 24, 34);
            greenTex.add('hit_0', 0, 26, 75, 25, 35);
            greenTex.add('guard', 0, 74, 75, 29, 35);
            greenTex.add('brushOff', 0, 124, 75, 29, 35);
            greenTex.add('stunned', 0, 170, 76, 35, 34);
            greenTex.add('death_0', 0, 44, 145, 66, 42);
            greenTex.add('hardDeath', 0, 137, 142, 54, 46);
            greenTex.add('wipedOut', 0, 220, 145, 69, 42);
            greenTex.add('minorDeath', 0, 317, 145, 49, 38);
            greenTex.add('victory_0', 0, 244, 78, 42, 35);
            greenTex.add('victory_1', 0, 312, 77, 40, 37);
            greenTex.add('victory_2', 0, 380, 76, 42, 37);
        }

        if (!this.anims.exists('red_idle')) {
            this.anims.create({ key: 'red_idle', frames: [{ key: 'red_team_atlas', frame: 'idle_0' }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'red_walk', frames: [{ key: 'red_team_atlas', frame: 'walking' }, { key: 'red_team_atlas', frame: 'walkingAlt' }], frameRate: 5, repeat: -1 });
            this.anims.create({ key: 'green_idle', frames: [{ key: 'green_team_atlas', frame: 'idle_0' }, { key: 'green_team_atlas', frame: 'idle_1' }], frameRate: 4, repeat: -1 });
            this.anims.create({
                key: 'green_victory',
                frames: [{ key: 'green_team_atlas', frame: 'victory_0' }, { key: 'green_team_atlas', frame: 'victory_1' }, { key: 'green_team_atlas', frame: 'victory_2' }],
                frameRate: 4, repeat: -1
            });
        }

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
        this.scoreText = this.makeText(20, STAGE_H - 30, '', { fontSize: '20px', color: '#cc0000', fontStyle: 'bold', fontFamily: 'Arial', stroke: '#fff', strokeThickness: 4 })
            .setDepth(210).setVisible(false);
        this.playAgainButton = this.makeText(STAGE_W - 20, STAGE_H - 18, 'Play Again', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
            backgroundColor: '#cc0000', padding: { x: 12, y: 6 }
        }).setOrigin(1, 1).setDepth(210).setVisible(false).setInteractive({ useHandCursor: true });
        this.playAgainButton.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
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
                this.activePlayer.bodySprite.setFrame('throw_0');
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
                    this.sfx('deny', 0.4);
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
            const kid = this.hoveredPlayer;
            if (pointer.leftButtonDown() && kid && kid.isAlive && !kid.isDazed) {
                this.activePlayer = kid;
                this.isDragging = true;
                this.pressTime = this.time.now;
                this.activePower = 0;
                this.grabOffsetX = pointer.worldX - kid.x;
                this.grabOffsetY = pointer.worldY - kid.y;
                kid.shadowLocked = true; // shadow stays at the grab point until release
                kid.bodySprite.setFrame('throw_0');
                this.showPowerMeter(kid);
            }
        });

        this.input.on('pointerup', (pointer) => {
            const kid = this.activePlayer;
            if (this.isDragging && kid && kid.isAlive && this.isLevelActive && pointer.leftButtonReleased()) {
                kid.shadowLocked = false;
                this.throwSnowball(kid, this.currentPower());
                this.hidePowerMeter();
                this.isDragging = false;
                this.hoveredPlayer = kid;
                this.activePlayer = null;
            }
        });

        this.input.on('pointerupoutside', () => {
            if (this.isDragging && this.activePlayer) {
                if (this.activePlayer.isAlive && !this.activePlayer.isDazed) this.activePlayer.bodySprite.play('red_idle');
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

    sfx(name, volume = 1, ifIdle = false) {
        const key = 'sfx_' + name;
        if (!this.cache.audio.exists(key)) return false;
        if (ifIdle && this.sfxBusy()) return false;
        this.sound.play(key, { volume });
        return true;
    }

    sfxBusy() {
        const playing = this.sound.getAllPlaying ? this.sound.getAllPlaying() : [];
        return playing.some(s => s && s.key && s.key.indexOf('sfx_') === 0);
    }

    // Original nextLevel / ridicule: repeat while soundBusy(1).
    whenSfxIdle(fn) {
        const tick = () => {
            if (!this.sfxBusy()) fn();
            else this.time.delayedCall(50, tick);
        };
        tick();
    }

    // Title screen: wait for a click (also unlocks browser audio) before the walk-on
    showTitle() {
        this.levelText.setText("Season's Greetings");
        this.levelText.setStyle({ fontSize: '40px', fontFamily: 'Georgia, serif' });
        this.levelText.setPosition(STAGE_W / 2, STAGE_H / 2).setAlpha(1).setVisible(true);
        this.subText.setText('Click to play').setVisible(true);
        this.input.once('pointerdown', () => {
            this.subText.setVisible(false);
            this.startLevel(START_LEVEL - 1);
        });
    }

    startLevel(index) {
        this.currentLevelIndex = index;
        this.killsThisLevel = 0;
        const layout = P.LEVELS[index];
        const isFirst = (index === 0);

        if (isFirst) {
            if (this.cache.audio.exists('sfx_intro')) this.sound.play('sfx_intro', { volume: 0.6 });
            if (!this.music.isPlaying) this.music.play();
        } else {
            this.sfx('level_start', 0.7);
        }

        this.stopAI();
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

        const message = isFirst ? "Season's Greetings" : 'LEVEL ' + (index + 1);
        this.levelText.setText(message);
        this.levelText.setStyle({
            fontSize: isFirst ? '40px' : '60px',
            fontFamily: isFirst ? 'Georgia, serif' : 'Arial, sans-serif'
        });
        this.levelText.setVisible(true);
        this.levelText.alpha = isFirst ? 1 : 0;
        this.levelText.y = STAGE_H / 2;

        this.tweens.add({
            targets: this.levelText,
            alpha: 1,
            duration: isFirst ? 600 : 1000,
            hold: isFirst ? 2500 : 1500,
            yoyo: true,
            onComplete: () => {
                this.textFadeComplete = true;
                this.checkLevelReady();
            }
        });
    }

    jumpToLevel(index) {
        if (index < 0 || index >= RULES.greensPerLevel.length) return;
        this.tweens.killTweensOf(this.levelText);
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
        const textureKey = (type === 'player') ? 'red_team_atlas' : 'green_team_atlas';
        const prefix = (type === 'player') ? 'red' : 'green';

        for (let i = 0; i < positions.length; i++) {
            const finalPos = positions[i];
            const finalX = finalPos.x;
            const finalY = finalPos.y;
            const offstage = P.isOffstage(finalPos);

            // On-stage kids walk in along the 2:1 throw diagonal (score frames 3–27).
            // Off-stage greens spawn at their VWSC loc and walk in via the edge rule.
            const offset = offstage ? 0 : 80;
            const spawnX = offstage ? finalX : (type === 'player' ? finalX + offset * 2 : finalX - offset * 2);
            const spawnY = offstage ? finalY : (type === 'player' ? finalY + offset : finalY - offset);

            let kid = this.add.container(spawnX, spawnY);
            let shadow = this.add.image(spawnX + 20, spawnY, 'shadow');
            shadow.setScale(1.2).setAlpha(0.6).setDepth(-5);
            this.shadowGroup.add(shadow);

            let sprite = this.add.sprite(0, 0, textureKey);
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

            if (DEBUG_MODE) {
                kid.debugLabel = this.makeText(0, -45, '', {
                    fontSize: '10px', color: '#000000', backgroundColor: '#ffffff', padding: { x: 2, y: 1 }
                }).setOrigin(0.5).setDepth(1000);
            }

            teamArray.push(kid);

            kid.finalX = finalX;
            kid.finalY = finalY;
            kid.myDirection = { x: 0, y: 0 };

            if (offstage) {
                kid.isWalkingOntoField = false;
                kid.ai = 'ready';
                sprite.play(prefix + '_idle');
                continue;
            }

            const walkingDistance = 3;
            kid.isWalkingOntoField = true;
            let walkToggle = true;
            this.walkingCount++;
            sprite.setFrame('walking');

            kid.walkTimer = this.time.addEvent({
                delay: RULES.aiTickMs,
                loop: true,
                callback: () => {
                    const dx = kid.finalX - kid.x;
                    const dy = kid.finalY - kid.y;
                    if (Math.abs(dx) <= walkingDistance && Math.abs(dy) <= walkingDistance) {
                        kid.x = kid.finalX;
                        kid.y = kid.finalY;
                        kid.isWalkingOntoField = false;
                        sprite.play(prefix + '_idle');
                        kid.walkTimer.remove();
                        kid.walkTimer = null;
                        this.walkingCount--;
                        this.checkLevelReady();
                        return;
                    }
                    // loc = loc + myDirection along the 2:1 diagonal
                    if (dx !== 0) kid.x += (dx > 0) ? walkingDistance * 2 : -walkingDistance * 2;
                    if (dy !== 0) kid.y += (dy > 0) ? walkingDistance : -walkingDistance;
                    walkToggle = !walkToggle;
                    sprite.setFrame(walkToggle ? 'walking' : 'walkingAlt');
                    this.stepSound();
                }
            });
        }
    }

    stepSound() {
        if (this.time.now - this.lastStepSound > 250) {
            this.lastStepSound = this.time.now;
            this.sfx('step', 0.35, true);
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
            if (kid.shadow && !kid.shadowLocked && kid.isAlive) kid.shadow.setPosition(kid.x + 20, kid.y);
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
        const prefix = (team === 'player') ? 'red' : 'green';

        thrower.bodySprite.setFrame(team === 'player' ? 'throw_1' : 'throw_2');
        if (team === 'player') {
            this.time.delayedCall(100, () => {
                if (thrower.isAlive && !thrower.isDazed) thrower.bodySprite.play(prefix + '_idle');
            });
        }

        if (this.teamBallCount(team) >= RULES.maxBallsPerTeam) return;

        const dir = (team === 'player') ? -1 : 1;
        const gx = thrower.x + dir * 8;
        const gy = thrower.y + 15;
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

        this.sfx(power >= RULES.maxPower ? 'throw_full' : 'throw', 0.8);
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
                if (b.range > 0) {
                    const targets = (b.team === 'player') ? this.greenTeam : this.redTeam;
                    const hit = targets.find(k => k.isAlive && !k.isImmune &&
                        Math.abs(b.gx - k.x) < 16 && Math.abs(b.gy - (k.y + 12)) < 20);
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
                    this.sfx('splat', 0.8, true);
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
        if (!kid.isAlive || kid.isImmune) return;
        kid.hits++;
        this.sfx('hit', 1.0);
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
            this.sfx('red_out', 0.6);
            this.knockOut(kid, 'death_0');
            return;
        }

        // Dazed: can't be grabbed, can still be hit
        this.sfx('red_daze', 0.8);
        kid.isDazed = true;
        kid.bodySprite.stop();
        kid.bodySprite.setFrame('hit_0');
        const cycle = ['hit_1', 'hit_2', 'hit_3'];
        let i = 0;
        kid.dazeTimer = this.time.addEvent({
            delay: 150, startAt: -100, loop: true,
            callback: () => kid.bodySprite.setFrame(cycle[i++ % cycle.length])
        });
        kid.dazeEnd = this.time.delayedCall(RULES.redDazeMs, () => {
            this.stopDaze(kid);
            if (kid.isAlive) kid.bodySprite.play('red_idle');
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
        // death check never fires again. Debug-only.
        kid.hits = RULES.redHitsToKO;
        kid.setAlpha(1);
        kid.bodySprite.play('red_idle');
    }

    hitGreen(kid) {
        this.cancelActions(kid);
        kid.ai = 'hurt';
        kid.bodySprite.stop();
        const hp = RULES.greenHitsToKO[GAME_DIFFICULTY] || 3;

        if (kid.hits >= hp) {
            this.sfx('green_out', 0.6);
            this.killsThisLevel++;
            this.knockOut(kid, Phaser.Utils.Array.GetRandom(['death_0', 'hardDeath', 'wipedOut', 'minorDeath']));
            return;
        }

        if (kid.hits === hp - 1) {
            // Knocked down: immune until back on their feet
            this.sfx('knockdown', 0.9);
            kid.isImmune = true;
            kid.bodySprite.setFrame('stunned');
            this.queueAction(kid, RULES.greenDownMs, () => {
                kid.isImmune = false;
                kid.bodySprite.setFrame('hit_0');
            }, true);
            this.queueAction(kid, RULES.greenDownMs + 500, () => kid.bodySprite.setFrame('brushOff'), true);
            this.queueAction(kid, RULES.greenDownMs + 1000, () => this.setReady(kid), true);
        } else {
            kid.bodySprite.setFrame('hit_0');
            this.queueAction(kid, RULES.greenOwMs, () => kid.bodySprite.setFrame('brushOff'), true);
            this.queueAction(kid, RULES.greenOwMs + RULES.greenRecoverMs, () => this.setReady(kid), true);
        }
    }

    knockOut(kid, frame) {
        kid.isAlive = false;
        kid.isImmune = false;
        kid.isDazed = false;
        this.cancelActions(kid);
        kid.bodySprite.stop();
        kid.bodySprite.setFrame(frame);
        if (kid.walkTimer) kid.walkTimer.remove();
        this.checkWinCondition();
    }

    // --- ENEMY AI ---
    // Every 100 ms each ready green rolls: 10% walk along the throw axis then throw,
    // 10% side-step, 20% throw, 60% stand still. Greens never aim.

    setReady(kid) {
        if (!kid.isAlive) return;
        kid.ai = 'ready';
        kid.bodySprite.play('green_idle');
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
                    kid.bodySprite.stop();
                } else if (roll === 2) {
                    kid.ai = 'side';
                    kid.stepsLeft = 5;
                    kid.myDirection = P.sideStepDirection(Phaser.Math.RND.sign());
                    kid.bodySprite.stop();
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
        kid.bodySprite.setFrame((kid.stepsLeft % 2) ? 'walking' : 'walkingAlt');
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
        kid.bodySprite.stop();
        kid.bodySprite.setFrame('throw_0');
        const cock = Phaser.Math.Between(RULES.cockMs[0], RULES.cockMs[1]);
        const release = RULES.windupMs + cock;
        this.queueAction(kid, RULES.windupMs, () => kid.bodySprite.setFrame('throw_1'));
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
    }

    // --- LEVEL FLOW & SCORE ---

    checkWinCondition() {
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
                k.bodySprite.play('red_idle');
            }
        });

        if (!greenAlive) this.levelCleared();
        else this.levelLost();
    }

    levelCleared() {
        this.score += this.greenTeam.length;
        const isLast = this.currentLevelIndex >= RULES.greensPerLevel.length - 1;
        // nextLevel waits while soundBusy(1) so the last kids/green_out cue finishes
        this.whenSfxIdle(() => {
            if (isLast) this.playThen('victory', 0.9, 1400, () => this.victory());
            else this.playThen('level_clear', 0.8, 1400, () => this.startLevel(this.currentLevelIndex + 1));
        });
    }

    // Play a sound after channel 1 is idle, then continue when it ends.
    playThen(name, volume, fallbackMs, next) {
        this.whenSfxIdle(() => {
            const key = 'sfx_' + name;
            let fired = false;
            const go = () => { if (!fired) { fired = true; next(); } };
            if (this.cache.audio.exists(key)) {
                const s = this.sound.add(key, { volume });
                s.once('complete', () => { s.destroy(); this.time.delayedCall(300, go); });
                s.play();
            }
            this.time.delayedCall(fallbackMs + 2000, go);
        });
    }

    levelLost() {
        this.score = (this.score + this.killsThisLevel) * (this.currentLevelIndex + 1);
        this.greenTeam.forEach(k => { if (k.isAlive) k.bodySprite.play('green_victory'); });

        // ridicule() twice: each laugh waits for soundBusy(1) before the next.
        this.whenSfxIdle(() => {
            this.sfx('cheer', 0.8);
            this.whenSfxIdle(() => {
                this.sfx('cheer', 0.8);
                this.whenSfxIdle(() => this.showEndScreen('GAME OVER'));
            });
        });

        const fallen = [...this.redTeam, ...this.greenTeam].filter(k => !k.isAlive);
        this.tweens.add({ targets: fallen, alpha: 0, duration: 1500, delay: 1000 });
        this.tweens.add({ targets: fallen.map(k => k.shadow), alpha: 0, duration: 1500, delay: 1000 });
    }

    victory() {
        this.score = this.score * 10;
        if (this.score > 900) this.score = 1000;
        this.showEndScreen('YOU WIN!');
    }

    showEndScreen(title) {
        this.levelText.setText(title);
        this.levelText.setStyle({ fontSize: '60px', fontFamily: 'Arial, sans-serif' });
        this.levelText.setPosition(STAGE_W / 2, STAGE_H / 2 - 20).setAlpha(0).setVisible(true);
        this.tweens.add({ targets: this.levelText, alpha: 1, duration: 800 });

        this.time.delayedCall(900, () => {
            this.playAgainButton.setVisible(true).setAlpha(0);
            this.tweens.add({ targets: this.playAgainButton, alpha: 1, duration: 500 });
            if (this.score > 0) {
                const counter = { n: 0 };
                this.scoreText.setVisible(true).setText('SCORE: 0');
                this.tweens.add({
                    targets: counter, n: this.score, duration: Math.min(2000, 200 + this.score * 4),
                    onUpdate: () => this.scoreText.setText('SCORE: ' + Math.round(counter.n))
                });
            }
        });
    }

    hideEndScreen() {
        this.playAgainButton.setVisible(false);
        this.scoreText.setVisible(false);
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

    // Spawn slot for greens beyond the fixed three: a free spot on the green side
    randomEnemySpawn(team) {
        let best = null, bestGap = -1;
        for (let attempt = 0; attempt < 40; attempt++) {
            const x = Phaser.Math.Between(30, 300);
            const y = Phaser.Math.Between(25, 170);
            if (y >= centreLineY(x) - 60) continue; // keep a margin from the centre line
            const gap = team.length
                ? Math.min(...team.map(k => Phaser.Math.Distance.Between(x, y, k.finalX, k.finalY)))
                : Infinity;
            if (gap > bestGap) { best = { x, y }; bestGap = gap; }
            if (gap >= 35) break;
        }
        return best || { x: 140, y: 70 };
    }

    createSnowSplash(x, y) {
        let splash = this.add.image(x, y, 'splash').setDepth(50);
        this.time.delayedCall(120, () => {
            splash.setTexture('sink');
            this.time.delayedCall(120, () => {
                splash.setTexture('puddle');
                this.tweens.add({
                    targets: splash, alpha: 0, duration: 1000, delay: 500,
                    onComplete: () => splash.destroy()
                });
            });
        });
    }

    // Kid under the pointer (bounding box around the sprite centre)
    kidAt(team, x, y) {
        const width = 35, height = 45;
        return team.find(kid => kid.isAlive && !kid.isWalkingOntoField &&
            Math.abs(x - kid.x) <= width / 2 && Math.abs(y - kid.y) <= height / 2) || null;
    }

    showSelectionUI(player) {
        this.selectionCircle.clear();
        this.selectionCircle.lineStyle(2, 0x0088cc, 1);
        this.selectionCircle.strokeEllipse(0, 0, 60, 30);
        this.selectionCircle.setPosition(player.x, player.y + 15);
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
        this.selectionCircle.setPosition(player.x, player.y + 15);
        if (this.powerMeter.visible) {
            const spec = P.CAST.power[this.activePower] || P.CAST.power[0];
            this.powerMeter.setTexture(spec.key);
            P.applyOrigin(this.powerMeter, spec);
            this.powerMeter.setPosition(player.x, player.y + 15);
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
            this.powerMeter.setPosition(this.activePlayer.x, this.activePlayer.y + 15);
        }
    }
}

game = new Phaser.Game(getConfig());

window.SnowcraftGame = {
    RULES,
    STAGE_W,
    STAGE_H,
    getGame: function () { return game; },
    getScene: function () {
        return game && game.scene && game.scene.scenes ? game.scene.scenes[0] : null;
    }
};
