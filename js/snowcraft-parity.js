/**
 * Verified original SnowCraft (Director 7 / Nicholson NY 1998–1999) rules.
 * Source: static Lingo recovery from SnowCraft.exe (never executed).
 * See docs/PARITY.md for verified vs inferred vs unverified.
 */
(function (root, factory) {
    root.SnowcraftParity = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = root.SnowcraftParity;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const TICK_MS = 1000 / 60;
    const CHAR_TEMPO_TICKS = 5;
    const BALL_TEMPO_TICKS = 2;
    const POWER_TICKS_PER_BAR = 5;
    const MAX_POWER = 8;
    const RED_HITS_TO_KO = 2;
    const GREEN_HITS_TO_KO = 3;
    const RED_DAZE_STEPS = 15;
    const LEVEL_CLEAR_MOUSE_SPLIT = 280;
    const MAX_GREEN_SPRITES = 12;
    const NAMED_LEVELS = 11;

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

    const UNUSED_CAST_SOUNDS = [
        {
            cast_member_name: "Uh",
            file: "assets/sounds/13_Uh.wav",
            reason: "Present as a sound cast member; no puppetSound/score reference recovered from Lingo."
        }
    ];

    const SOUND_EVENTS = {
        throw_full: {
            id: "whoosh",
            evidence: "Snowball red/green prepareFrame: if myRange = 16 then puppetSound(\"Whoosh\") (power 8)."
        },
        throw_normal: {
            id: "whoosh_percussive",
            evidence: "Same handlers: else puppetSound(\"Whoosh Percusive\") for sb 0–7."
        },
        person_impact: {
            id: "hit1",
            evidence: "Snowball scripts play puppetSound(\"hit1\") on sprite intersect with an opponent."
        },
        ground_land: {
            id: "splat",
            evidence: "Member splat: if not soundBusy(1) then puppetSound(\"splat\")."
        },
        walk_step: {
            id: "step",
            evidence: "GREEN DUDES walk frames and movie step handler: if not soundBusy(1) then puppetSound(\"step\")."
        },
        red_stun: {
            id: "bird_tweets",
            evidence: "RED DUDES: on R hit2 when myHits <> 2, puppetSound(\"bird_tweets\")."
        },
        red_death: {
            id: "ahhhh",
            evidence: "RED DUDES: on R hit2 when myHits = 2, puppetSound(\"Ahhhh!\")."
        },
        green_second_hit: {
            id: "hit2",
            evidence: "GREEN DUDES: on G Hit2 when myHits = 2, puppetSound(\"hit2\")."
        },
        green_death: {
            id: "kids_n",
            evidence: "GREEN DUDES: on G Hit2 when myHits = 3, puppetSound(\"kids\" & random(3))."
        },
        dead_hover: {
            id: "short_chirps",
            evidence: "RED DUDES mouseEnter: puppetSound(\"short_chirps\") when the sprite is not selectable."
        },
        level_clear_left: {
            id: "ugly",
            evidence: "nextLevel: if the mouseH < 280 then puppetSound(\"ugly\")."
        },
        level_clear_right: {
            id: "halaluja",
            evidence: "nextLevel: else puppetSound(\"halaluja\")."
        },
        game_over: {
            id: "laugh",
            evidence: "Event Loop: when gRDead = 3, ridicule() twice; ridicule starts with puppetSound(\"laugh\")."
        }
    };

    const CHANNEL1_IDLE_ONLY = ["step", "splat"];
    const CHANNEL1_EVENTS = [
        "whoosh",
        "whoosh_percussive",
        "hit1",
        "hit2",
        "splat",
        "step",
        "bird_tweets",
        "ahhhh",
        "kids1",
        "kids2",
        "kids3",
        "laugh",
        "ugly",
        "halaluja",
        "short_chirps"
    ];

    function greenCountForLevel(level) {
        const n = Math.max(1, Math.min(NAMED_LEVELS, level | 0));
        return Math.min(MAX_GREEN_SPRITES, 2 * n + 1);
    }

    function throwRangeSteps(power) {
        const p = clampPower(power);
        return p * 2;
    }

    function clampPower(power) {
        const n = Math.floor(Number(power) || 0);
        if (n < 0) return 0;
        if (n > MAX_POWER) return MAX_POWER;
        return n;
    }

    function powerFromHoldMs(elapsedMs) {
        const ticks = elapsedMs / TICK_MS;
        return clampPower(Math.floor(ticks / POWER_TICKS_PER_BAR));
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

    function ballStepForTeam(teamType) {
        if (teamType === "player") {
            return { x: -20, y: -10 };
        }
        return { x: 20, y: 10 };
    }

    function dropStepForTeam(teamType) {
        if (teamType === "player") {
            return { x: -10, y: -5 };
        }
        return { x: 10, y: 5 };
    }

    function hitsToKo(teamType) {
        return teamType === "player" ? RED_HITS_TO_KO : GREEN_HITS_TO_KO;
    }

    function scoreOnLevelWin(currentScore, greensKilledThisLevel) {
        return currentScore + greensKilledThisLevel;
    }

    function scoreOnGameOver(currentScore, greensKilledThisLevel, level) {
        return (currentScore + greensKilledThisLevel) * level;
    }

    function expectedWiredSoundIds() {
        return Object.keys(SOUND_FILES);
    }

    function isIdleGated(soundId) {
        return CHANNEL1_IDLE_ONLY.indexOf(soundId) !== -1;
    }

    return {
        TICK_MS,
        CHAR_TEMPO_TICKS,
        BALL_TEMPO_TICKS,
        POWER_TICKS_PER_BAR,
        MAX_POWER,
        RED_HITS_TO_KO,
        GREEN_HITS_TO_KO,
        RED_DAZE_STEPS,
        LEVEL_CLEAR_MOUSE_SPLIT,
        MAX_GREEN_SPRITES,
        NAMED_LEVELS,
        SOUND_FILES,
        SOUND_EVENTS,
        UNUSED_CAST_SOUNDS,
        CHANNEL1_IDLE_ONLY,
        CHANNEL1_EVENTS,
        greenCountForLevel,
        throwRangeSteps,
        clampPower,
        powerFromHoldMs,
        throwSoundId,
        levelClearSoundId,
        kidsDeathSoundId,
        ballStepForTeam,
        dropStepForTeam,
        hitsToKo,
        scoreOnLevelWin,
        scoreOnGameOver,
        expectedWiredSoundIds,
        isIdleGated
    };
});
