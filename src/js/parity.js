/**
 * Recovered original SnowCraft (Director 8 / Nicholson NY 1999) constants.
 *
 * Evidence: static mmap, KEY-star and VWSC parse of SnowCraft.exe (never
 * executed) plus Lingo recovered from Lscr bytecode. Originals:
 * docs/reference/snowcraft-original/. See docs/PARITY.md.
 *
 * Coordinates are Director stage pixels (592×320). The ground BITD is 600×320
 * at loc (296,160) with registration (300,160), so 4 px overhangs each side.
 */
(function (root, factory) {
    root.SnowcraftParity = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = root.SnowcraftParity;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const TICK_MS = 1000 / 60;
    const CHAR_TEMPO_TICKS = 5; // kids step every 6 ticks ≈ 100 ms
    const BALL_TEMPO_TICKS = 2; // balls step every 3 ticks ≈ 50 ms
    const POWER_TICKS_PER_BAR = 5;
    const MAX_POWER = 8;
    const RED_HITS_TO_KO = 2;
    const GREEN_HITS_TO_KO = 3;
    const DROP_STEPS = 4;
    const MELT_STEPS = 4;
    const MAX_BALLS_PER_TEAM = 10;
    const LEVEL_CLEAR_MOUSE_SPLIT = 280;
    // Channel 1: nextLevel and each ridicule() wait while soundBusy(1).
    const CHANNEL1 = {
        nextLevelWaitsForIdle: true,
        ridiculeCount: 2,
        ridiculeWaitsForIdle: true
    };
    // Original WAVs, paths relative to the src/ site root.
    const SOUND_FILES = {
        bird_tweets: "assets/sounds/01_bird_tweets.wav",
        laugh: "assets/sounds/02_laugh.wav",
        ahhhh: "assets/sounds/03_Ahhhh.wav",
        ugly: "assets/sounds/04_ugly.wav",
        short_chirps: "assets/sounds/05_short_chirps.wav",
        whoosh: "assets/sounds/06_Whoosh.wav",
        kids3: "assets/sounds/07_kids3.wav",
        step: "assets/sounds/08_step.wav",
        kids2: "assets/sounds/09_kids2.wav",
        kids1: "assets/sounds/10_kids1.wav",
        hit1: "assets/sounds/11_hit1.wav",
        whoosh_percussive: "assets/sounds/12_Whoosh_Percusive.wav",
        splat: "assets/sounds/14_splat.wav",
        hit2: "assets/sounds/15_hit2.wav",
        halaluja: "assets/sounds/16_halaluja.wav"
    };
    const CHANNEL1_IDLE_ONLY = ["step", "splat"];
    const STAGE_W = 592;
    const STAGE_H = 320;
    // Pre-existing display scaler (local edits): 1× = 600×320 … 3× = 1800×960,
    // plus fit-to-window. Logical gameplay stays the Director stage above.
    const DISPLAY_BASE_W = 600;
    const DISPLAY_BASE_H = 320;
    const DISPLAY_FIT_RESERVED_H = 230;
    const DISPLAY_FIT_MIN_W = 300;
    const DISPLAY_RENDER_SCALE_MAX = 4;

    // Event Loop frames from VWSC. Off-stage greens (x<0 or y<0) walk in via
    // the locH<40 / locV<40 edge rule, not a scripted walk-on.
    const LEVELS = [
        {
            level: 1, gd: 3,
            greens: [{ x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 }],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 2, gd: 5,
            greens: [
                { x: -7, y: -34 }, { x: -9, y: 28 },
                { x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 3, gd: 7,
            greens: [
                { x: 53, y: -14 }, { x: -39, y: 48 }, { x: 153, y: -14 }, { x: -49, y: 108 },
                { x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 4, gd: 9,
            greens: [
                { x: 68, y: -21 }, { x: -7, y: 33 }, { x: 109, y: -21 }, { x: -8, y: 96 },
                { x: 36, y: -18 }, { x: -3, y: 172 },
                { x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 5, gd: 12,
            greens: [
                { x: 0, y: 106 }, { x: 138, y: -21 }, { x: 0, y: 53 }, { x: 234, y: -6 },
                { x: 3, y: 183 }, { x: 307, y: -11 }, { x: 0, y: 240 }, { x: 391, y: -6 },
                { x: -2, y: 152 }, { x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 6, gd: 12,
            greens: [
                { x: 118, y: -7 }, { x: 20, y: -7 }, { x: -15, y: 75 },
                { x: 176, y: 49 }, { x: 73, y: 46 }, { x: 71, y: 108 },
                { x: 266, y: 99 }, { x: 163, y: 96 }, { x: 161, y: 158 },
                { x: 401, y: 153 }, { x: 298, y: 150 }, { x: 296, y: 212 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 7, gd: 12,
            greens: [
                { x: 470, y: 52 }, { x: 410, y: 97 }, { x: 350, y: 137 }, { x: 290, y: 177 },
                { x: 230, y: 217 }, { x: 170, y: 257 },
                { x: 520, y: 57 }, { x: 460, y: 97 }, { x: 400, y: 137 }, { x: 340, y: 177 },
                { x: 280, y: 217 }, { x: 220, y: 257 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 8, gd: 12,
            greens: [
                { x: 430, y: 77 }, { x: 396, y: 91 }, { x: 432, y: 114 },
                { x: 339, y: 139 }, { x: 309, y: 173 }, { x: 344, y: 174 },
                { x: 82, y: 227 }, { x: 130, y: 226 }, { x: 175, y: 228 },
                { x: 104, y: 267 }, { x: 152, y: 269 }, { x: 124, y: 302 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 9, gd: 12,
            greens: [
                { x: 242, y: 47 }, { x: 290, y: 46 }, { x: 335, y: 48 },
                { x: 264, y: 87 }, { x: 312, y: 89 }, { x: 284, y: 122 },
                { x: 132, y: 227 }, { x: 180, y: 226 }, { x: 225, y: 228 },
                { x: 154, y: 267 }, { x: 202, y: 269 }, { x: 174, y: 302 }
            ],
            reds: [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }]
        },
        {
            level: 10, gd: 12,
            greens: [
                { x: 321, y: 174 }, { x: 357, y: 184 }, { x: 95, y: 199 },
                { x: 110, y: 232 }, { x: 73, y: 232 }, { x: 52, y: 264 },
                { x: 88, y: 264 }, { x: 126, y: 264 },
                { x: 30, y: 297 }, { x: 67, y: 297 }, { x: 105, y: 296 }, { x: 143, y: 299 }
            ],
            reds: [{ x: 408, y: 221 }, { x: 346, y: 257 }, { x: 290, y: 300 }]
        }
    ];

    // BITD registration points (pixels from bitmap top-left to Director loc).
    const CAST = {
        power: [
            { key: "power_0", w: 4, h: 3, reg: [-27, -1] },
            { key: "power_1", w: 9, h: 9, reg: [-27, 5] },
            { key: "power_2", w: 9, h: 12, reg: [-27, 8] },
            { key: "power_3", w: 9, h: 15, reg: [-27, 11] },
            { key: "power_4", w: 9, h: 18, reg: [-27, 14] },
            { key: "power_5", w: 9, h: 21, reg: [-27, 17] },
            { key: "power_6", w: 9, h: 24, reg: [-27, 20] },
            { key: "power_7", w: 9, h: 27, reg: [-27, 23] },
            { key: "power_8", w: 9, h: 30, reg: [-27, 26] }
        ],
        snowball: { key: "cast_snowball", w: 11, h: 42, reg: [5, 38] },
        drop: [
            { key: "drop_0", w: 11, h: 39, reg: [5, 35] },
            { key: "drop_1", w: 10, h: 34, reg: [5, 30] },
            { key: "drop_2", w: 10, h: 27, reg: [5, 23] },
            { key: "drop_3", w: 10, h: 18, reg: [5, 14] }
        ],
        splat: { key: "cast_splat", w: 16, h: 7, reg: [8, 3] },
        melt: [
            { key: "melt_0", w: 17, h: 13, reg: [8, 6] },
            { key: "melt_1", w: 22, h: 16, reg: [11, 8] },
            { key: "melt_2", w: 22, h: 16, reg: [11, 8] },
            { key: "melt_3", w: 22, h: 16, reg: [11, 8] }
        ],
        kids: [
            { num: 1, name: "shadow", key: "cast_001_shadow", file: "001_shadow.png", w: 36, h: 21, reg: [6, 17] },
            { num: 2, name: "R Auto walk_1", key: "cast_002_R_Auto_walk_1", file: "002_R_Auto_walk_1.png", w: 25, h: 34, reg: [15, 28] },
            { num: 3, name: "R Auto walk_2", key: "cast_003_R_Auto_walk_2", file: "003_R_Auto_walk_2.png", w: 31, h: 35, reg: [19, 28] },
            { num: 4, name: "R rest", key: "cast_004_R_rest", file: "004_R_rest.png", w: 24, h: 33, reg: [14, 28] },
            { num: 5, name: "R ready", key: "cast_005_R_ready", file: "005_R_ready.png", w: 26, h: 34, reg: [15, 28] },
            { num: 6, name: "R pop", key: "cast_006_R_pop", file: "006_R_pop.png", w: 63, h: 49, reg: [33, 29] },
            { num: 7, name: "R cock", key: "cast_007_R_cock", file: "007_R_cock.png", w: 63, h: 49, reg: [33, 29] },
            { num: 8, name: "R toss", key: "cast_008_R_toss", file: "008_R_toss.png", w: 63, h: 51, reg: [33, 31] },
            { num: 9, name: "R hit", key: "cast_009_R_hit", file: "009_R_hit.png", w: 46, h: 33, reg: [15, 26] },
            { num: 10, name: "R hit2", key: "cast_010_R_hit2", file: "010_R_hit2.png", w: 46, h: 33, reg: [15, 26] },
            { num: 11, name: "R daze1", key: "cast_011_R_daze1", file: "011_R_daze1.png", w: 35, h: 43, reg: [21, 37] },
            { num: 12, name: "R daze2", key: "cast_012_R_daze2", file: "012_R_daze2.png", w: 36, h: 44, reg: [22, 38] },
            { num: 13, name: "R daze3", key: "cast_013_R_daze3", file: "013_R_daze3.png", w: 35, h: 40, reg: [21, 34] },
            { num: 14, name: "R dead", key: "cast_014_R_dead", file: "014_R_dead.png", w: 71, h: 33, reg: [-4, -4] },
            { num: 15, name: "R dead", key: "cast_015_R_dead", file: "015_R_dead.png", w: 68, h: 49, reg: [-5, 2] },
            { num: 16, name: "R dead", key: "cast_016_R_dead", file: "016_R_dead.png", w: 51, h: 53, reg: [-3, 15] },
            { num: 17, name: "G yea", key: "cast_017_G_yea", file: "017_G_yea.png", w: 42, h: 35, reg: [22, 26] },
            { num: 18, name: "G yea", key: "cast_018_G_yea", file: "018_G_yea.png", w: 40, h: 37, reg: [20, 29] },
            { num: 19, name: "G yea", key: "cast_019_G_yea", file: "019_G_yea.png", w: 42, h: 37, reg: [22, 29] },
            { num: 20, name: "G Walk H2", key: "cast_020_G_Walk_H2", file: "020_G_Walk_H2.png", w: 30, h: 36, reg: [12, 29] },
            { num: 21, name: "G Walk H1", key: "cast_021_G_Walk_H1", file: "021_G_Walk_H1.png", w: 32, h: 36, reg: [13, 29] },
            { num: 22, name: "G Walk V1", key: "cast_022_G_Walk_V1", file: "022_G_Walk_V1.png", w: 30, h: 36, reg: [13, 29] },
            { num: 23, name: "G Walk V2", key: "cast_023_G_Walk_V2", file: "023_G_Walk_V2.png", w: 27, h: 34, reg: [11, 28] },
            { num: 24, name: "G ready", key: "cast_024_G_ready", file: "024_G_ready.png", w: 25, h: 36, reg: [11, 29] },
            { num: 25, name: "G windup", key: "cast_025_G_windup", file: "025_G_windup.png", w: 24, h: 31, reg: [7, 23] },
            { num: 26, name: "G cock", key: "cast_026_G_cock", file: "026_G_cock.png", w: 34, h: 35, reg: [22, 26] },
            { num: 27, name: "G toss", key: "cast_027_G_toss", file: "027_G_toss.png", w: 24, h: 34, reg: [8, 26] },
            { num: 28, name: "G Hit", key: "cast_028_G_Hit", file: "028_G_Hit.png", w: 25, h: 35, reg: [13, 28] },
            { num: 29, name: "G Hit2", key: "cast_029_G_Hit2", file: "029_G_Hit2.png", w: 25, h: 35, reg: [13, 28] },
            { num: 30, name: "G ow", key: "cast_030_G_ow", file: "030_G_ow.png", w: 29, h: 35, reg: [12, 28] },
            { num: 31, name: "G recover", key: "cast_031_G_recover", file: "031_G_recover.png", w: 29, h: 35, reg: [12, 28] },
            { num: 32, name: "G down", key: "cast_032_G_down", file: "032_G_down.png", w: 35, h: 34, reg: [33, 29] },
            { num: 33, name: "G dead", key: "cast_033_G_dead", file: "033_G_dead.png", w: 66, h: 42, reg: [70, 40] },
            { num: 34, name: "G dead", key: "cast_034_G_dead", file: "034_G_dead.png", w: 54, h: 46, reg: [60, 39] },
            { num: 35, name: "G dead", key: "cast_035_G_dead", file: "035_G_dead.png", w: 69, h: 42, reg: [73, 34] },
            { num: 36, name: "G dead", key: "cast_036_G_dead", file: "036_G_dead.png", w: 49, h: 38, reg: [56, 36] }
        ],
        ground: { key: "cast_ground", file: "069_ground.png", w: 600, h: 320, reg: [300, 160], loc: [296, 160], ink: 0 },
        title: { key: "cast_title", file: "076_1.png", w: 122, h: 22, reg: [76, 14], loc: [296, 160], ink: 8 },
        logo: { key: "cast_logo", file: "070_happy_holidays.png", w: 254, h: 64, reg: [127, 32], loc: [296, 140], ink: 8 },
        congrats: { key: "cast_congrats", file: "088_congratulations.png", w: 190, h: 31, reg: [95, 15], loc: [295, 160], ink: 8 },
        playAgain: { key: "cast_play_again", file: "077_play_again.png", w: 84, h: 22, reg: [-216, -138], loc: [292, 160], victoryLoc: [296, 160], ink: 8 },
        levelWord: { key: "cast_level_word", file: "078_Level.png", w: 63, h: 22, reg: [43, 11], loc: [286, 160], ink: 8 },
        levelDigit: {
            2: { key: "cast_level_2", file: "079_2.png", w: 13, h: 21, reg: [-30, 10], loc: [326, 160], ink: 8, castReg: [-30, 10] },
            3: { key: "cast_level_3", file: "080_3.png", w: 14, h: 21, reg: [-29, 10], loc: [326, 160], ink: 8, castReg: [-29, 10] },
            4: { key: "cast_level_4", file: "081_4.png", w: 14, h: 21, reg: [-30, 10], loc: [326, 160], ink: 8, castReg: [-30, 10] },
            5: { key: "cast_level_5", file: "082_5.png", w: 13, h: 22, reg: [-30, 12], loc: [326, 160], ink: 8, castReg: [54, 12] },
            6: { key: "cast_level_6", file: "083_6.png", w: 14, h: 22, reg: [-30, 12], loc: [326, 160], ink: 8, castReg: [30, 12] },
            7: { key: "cast_level_7", file: "084_7.png", w: 15, h: 21, reg: [-30, 11], loc: [326, 160], ink: 8, castReg: [7, 11] },
            8: { key: "cast_level_8", file: "085_8.png", w: 14, h: 21, reg: [-30, 11], loc: [326, 160], ink: 8, castReg: [-17, 11] },
            9: { key: "cast_level_9", file: "086_9.png", w: 14, h: 23, reg: [-30, 11], loc: [326, 160], ink: 8, castReg: [-41, 11] }
        },
        bonusRound: { key: "cast_bonus_round", file: "087_bonus_round.png", w: 158, h: 23, reg: [79, 11], loc: [285, 160], ink: 8 }
    };
    const SCORE_WALKON_FPS = 15; // VWSC tempo on Level 1 (frame 1). Levels 2–11 / GreenWin are 10 fps.
    const SCORE_BANNER_FPS = 10;
    const SCORE_UI = {
        title: { fps: 15, fadeIn: 15, hold: 7, fadeOut: 4 },
        levelBanner: { fps: 10, fadeIn: 0, hold: 1, fadeOut: 10 },
        congrats: { fps: 10, fadeIn: 11, hold: 2, fadeOut: 14 },
        logoVictory: { fps: 10, fadeIn: 9, hold: 0, fadeOut: 0 },
        playAgain: { fps: 10, fadeIn: 5 }
    };
    // VWSC loc 326 is shared by digits 2–9. 8-bit 2 and 4 place the glyph at
    // left = 326 - (-30) = 356. 32-bit CASt regs 5–9 are a 24px filmstrip leftover.
    const DIGIT_SLOT_LEFT = 356;

    function scoreTempoFps(level) {
        return Number(level) === 1 ? SCORE_WALKON_FPS : SCORE_BANNER_FPS;
    }

    function bannerTiming(level) {
        return Number(level) === 1 ? SCORE_UI.title : SCORE_UI.levelBanner;
    }

    function framesToMs(frames, fps) {
        return Math.round((Number(frames) || 0) * 1000 / (Number(fps) || 15));
    }

    function directorBlendToAlpha(blend) {
        const b = Number(blend);
        if (!Number.isFinite(b)) return 1;
        if (b <= 0) return 1;
        if (b >= 255) return 0;
        return 1 - b / 255;
    }
    const INK_MATTE = 8;
    const RED_DAZE_CYCLES = 15; // mySteps = 15 of daze1/2/3
    const GREEN_OW_MOVES = 10;
    const GREEN_DOWN_MOVES = 25;
    const GREEN_RECOVER_MOVES = 5;

    function clampPower(power) {
        const n = Math.floor(Number(power) || 0);
        if (n < 0) return 0;
        if (n > MAX_POWER) return MAX_POWER;
        return n;
    }

    function powerFromHoldMs(elapsedMs) {
        return clampPower(Math.floor((elapsedMs / TICK_MS) / POWER_TICKS_PER_BAR));
    }

    // Flight steps before the drop. Power 0 still takes one snowball step, then drop.
    function throwRangeSteps(power) {
        return clampPower(power) * 2;
    }

    function throwSoundId(power) {
        return clampPower(power) === MAX_POWER ? "whoosh" : "whoosh_percussive";
    }

    function levelClearSoundId(mouseH) {
        return mouseH < LEVEL_CLEAR_MOUSE_SPLIT ? "ugly" : "halaluja";
    }

    function kidsDeathSoundId(randomInt1to3) {
        const n = Math.floor(Number(randomInt1to3));
        if (n === 1) return "kids1";
        if (n === 2) return "kids2";
        return "kids3";
    }

    function expectedWiredSoundIds() {
        return Object.keys(SOUND_FILES);
    }

    function isIdleGated(soundId) {
        return CHANNEL1_IDLE_ONLY.indexOf(soundId) !== -1;
    }

    function flightHitSteps(power) {
        return Math.max(0, throwRangeSteps(power) - 1);
    }

    function ballStepForTeam(teamType) {
        return teamType === "player" ? { x: -20, y: -10 } : { x: 20, y: 10 };
    }

    function dropStepForTeam(teamType) {
        return teamType === "player" ? { x: -10, y: -5 } : { x: 10, y: 5 };
    }

    function walkAxisDirection(sign) {
        const s = sign < 0 ? -1 : 1;
        return { x: 2 * s, y: 1 * s };
    }

    function sideStepDirection(sign) {
        const s = sign < 0 ? -1 : 1;
        return { x: 1 * s, y: 2 * s };
    }

    function edgeSteer(x, y, dir) {
        const next = { x: dir.x, y: dir.y };
        if (x < 40) {
            next.x = 4;
            next.y = 1;
        } else if (y < 40) {
            next.x = 1;
            next.y = 4;
        }
        return next;
    }

    // Original centre line: x = 2*(320 − y), from (0,320) to (640,0).
    function centreLineY(x) {
        return STAGE_H - x / 2;
    }

    function onRedSide(x, y) {
        return x >= 2 * (STAGE_H - y);
    }

    function isOffstage(pos) {
        return pos.x < 8 || pos.y < 8;
    }

    function scoreOnLevelWin(currentScore, greensOnLevel) {
        return currentScore + greensOnLevel;
    }

    function scoreOnGameOver(currentScore, greensKilledThisLevel, level) {
        return (currentScore + greensKilledThisLevel) * level;
    }

    function scoreOnVictory(currentScore) {
        const n = currentScore * 10;
        return n > 900 ? 1000 : n;
    }

    function ballFrame(phase, frame) {
        if (phase === "fly") return CAST.snowball;
        if (phase === "drop") return CAST.drop[Math.max(0, Math.min(DROP_STEPS - 1, frame))];
        if (phase === "splat") return CAST.splat;
        return CAST.melt[Math.max(0, Math.min(MELT_STEPS - 1, frame))];
    }

    function applyOrigin(image, cast) {
        if (!image || !cast) return;
        const ox = cast.w ? cast.reg[0] / cast.w : 0.5;
        const oy = cast.h ? cast.reg[1] / cast.h : 0.5;
        image.setOrigin(ox, oy);
    }

    function clampInt(n, lo, hi) {
        const v = Math.floor(Number(n) || 0);
        if (v < lo) return lo;
        if (v > hi) return hi;
        return v;
    }

    // reservedH / marginW: page chrome to leave around a fit-to-window game.
    // Defaults suit the desktop page; phones in landscape or full screen pass ~0.
    function computeDisplayLayout(gameScale, innerWidth, innerHeight, devicePixelRatio, reservedH, marginW) {
        let width;
        const scale = Number(gameScale) || 0;
        const reserve = typeof reservedH === "number" ? reservedH : DISPLAY_FIT_RESERVED_H;
        const margin = typeof marginW === "number" ? marginW : 40;
        if (scale > 0) {
            width = DISPLAY_BASE_W * scale;
        } else {
            width = Math.min(
                (Number(innerWidth) || 0) - margin,
                ((Number(innerHeight) || 0) - reserve) * DISPLAY_BASE_W / DISPLAY_BASE_H
            );
            width = Math.max(DISPLAY_FIT_MIN_W, Math.floor(width));
        }
        const height = Math.round(width * DISPLAY_BASE_H / DISPLAY_BASE_W);
        const dpr = Number(devicePixelRatio) || 1;
        const renderScale = clampInt(
            Math.ceil((width / DISPLAY_BASE_W) * dpr),
            1,
            DISPLAY_RENDER_SCALE_MAX
        );
        return { width, height, renderScale };
    }

    function fitCanvasCssSize(containerW, containerH, stageW, stageH) {
        const s = Math.min(containerW / stageW, containerH / stageH);
        return { width: stageW * s, height: stageH * s, scale: s };
    }

    function canvasCssToWorld(cssX, cssY, canvasCssW, canvasCssH, stageW, stageH) {
        return {
            x: (cssX / canvasCssW) * stageW,
            y: (cssY / canvasCssH) * stageH
        };
    }

    function worldToCanvasCss(worldX, worldY, canvasCssW, canvasCssH, stageW, stageH) {
        return {
            x: (worldX / stageW) * canvasCssW,
            y: (worldY / stageH) * canvasCssH
        };
    }

    function kidMembersNamed(name) {
        return CAST.kids.filter((m) => m.name === name);
    }

    function kidMember(name, variant) {
        const list = kidMembersNamed(name);
        if (!list.length) return null;
        const i = Math.max(0, Math.min(list.length - 1, variant | 0));
        return list[i];
    }

    // Director sprite rect: loc is the registration point of the BITD.
    function memberRect(x, y, cast) {
        if (!cast) return { left: x, top: y, right: x, bottom: y };
        return {
            left: x - cast.reg[0],
            top: y - cast.reg[1],
            right: x - cast.reg[0] + cast.w,
            bottom: y - cast.reg[1] + cast.h
        };
    }

    function rectsOverlap(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    // Director matte ink: opaque (non-index-0) pixels of both sprites overlap.
    function mattesOverlap(ax, ay, aCast, aMask, bx, by, bCast, bMask) {
        if (!aCast || !bCast || !aMask || !bMask) return false;
        const ar = memberRect(ax, ay, aCast);
        const br = memberRect(bx, by, bCast);
        if (!rectsOverlap(ar, br)) return false;
        const left = Math.max(Math.ceil(ar.left), Math.ceil(br.left));
        const top = Math.max(Math.ceil(ar.top), Math.ceil(br.top));
        const right = Math.min(Math.floor(ar.right), Math.floor(br.right));
        const bottom = Math.min(Math.floor(ar.bottom), Math.floor(br.bottom));
        for (let y = top; y < bottom; y++) {
            const ayi = y - ar.top;
            const byi = y - br.top;
            for (let x = left; x < right; x++) {
                const ai = ayi * aMask.w + (x - ar.left);
                const bi = byi * bMask.w + (x - br.left);
                if (aMask.bits[ai] && bMask.bits[bi]) return true;
            }
        }
        return false;
    }

    return {
        TICK_MS,
        CHAR_TEMPO_TICKS,
        BALL_TEMPO_TICKS,
        POWER_TICKS_PER_BAR,
        MAX_POWER,
        RED_HITS_TO_KO,
        GREEN_HITS_TO_KO,
        DROP_STEPS,
        MELT_STEPS,
        MAX_BALLS_PER_TEAM,
        LEVEL_CLEAR_MOUSE_SPLIT,
        CHANNEL1,
        SOUND_FILES,
        CHANNEL1_IDLE_ONLY,
        throwSoundId,
        levelClearSoundId,
        kidsDeathSoundId,
        expectedWiredSoundIds,
        isIdleGated,
        STAGE_W,
        STAGE_H,
        DISPLAY_BASE_W,
        DISPLAY_BASE_H,
        DISPLAY_FIT_RESERVED_H,
        DISPLAY_FIT_MIN_W,
        DISPLAY_RENDER_SCALE_MAX,
        computeDisplayLayout,
        fitCanvasCssSize,
        canvasCssToWorld,
        worldToCanvasCss,
        LEVELS,
        CAST,
        SCORE_WALKON_FPS,
        SCORE_BANNER_FPS,
        SCORE_UI,
        DIGIT_SLOT_LEFT,
        scoreTempoFps,
        bannerTiming,
        framesToMs,
        directorBlendToAlpha,
        INK_MATTE,
        RED_DAZE_CYCLES,
        GREEN_OW_MOVES,
        GREEN_DOWN_MOVES,
        GREEN_RECOVER_MOVES,
        kidMembersNamed,
        kidMember,
        memberRect,
        rectsOverlap,
        mattesOverlap,
        clampPower,
        powerFromHoldMs,
        throwRangeSteps,
        flightHitSteps,
        ballStepForTeam,
        dropStepForTeam,
        walkAxisDirection,
        sideStepDirection,
        edgeSteer,
        centreLineY,
        onRedSide,
        isOffstage,
        scoreOnLevelWin,
        scoreOnGameOver,
        scoreOnVictory,
        ballFrame,
        applyOrigin
    };
});
