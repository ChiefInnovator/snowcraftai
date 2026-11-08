/**
 * Recovered original SnowCraft (Director 8 / Nicholson NY 1999) constants.
 *
 * Evidence: static mmap, KEY-star and VWSC parse of SnowCraft.exe (never
 * executed) plus Lingo recovered from Lscr bytecode. See docs/PARITY.md.
 *
 * Coordinates are Director stage pixels (592×320). The remake draws them on a
 * 600×320 canvas without scaling — the original ground bitmap is already 600 wide.
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
    // Channel 1: nextLevel and each ridicule() wait while soundBusy(1).
    const CHANNEL1 = {
        nextLevelWaitsForIdle: true,
        ridiculeCount: 2,
        ridiculeWaitsForIdle: true
    };
    const STAGE_W = 592;
    const STAGE_H = 320;

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
        ]
    };

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
        CHANNEL1,
        STAGE_W,
        STAGE_H,
        LEVELS,
        CAST,
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
