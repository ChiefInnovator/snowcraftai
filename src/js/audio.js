/**
 * Original SnowCraft channel-1 puppetSound behavior for the web remake.
 * One SFX channel: unconditional plays replace the previous clip; step/splat
 * play only when the channel is idle (soundBusy(1) in Lingo).
 * No detune / random pitch. Sample-rate is whatever the WAV header stores.
 */
(function (root, factory) {
    root.SnowcraftAudio = factory(root.SnowcraftParity);
    if (typeof module !== "undefined" && module.exports) {
        module.exports = root.SnowcraftAudio;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Parity) {
    const STORAGE_MUTE_KEY = "snowcraft-muted";

    function nowMs() {
        if (typeof performance !== "undefined" && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    function createSnowcraftAudio(adapter) {
        const playAdapter = adapter && adapter.play ? adapter : { play: function () { return { durationMs: 0 }; } };
        const stopAdapter = adapter && adapter.stopAll ? adapter : { stopAll: function () {} };
        const playingAdapter = adapter && adapter.isPlaying ? adapter : { isPlaying: function () { return false; } };
        const unlockAdapter = adapter && adapter.unlock ? adapter : { unlock: function () { return true; } };

        const state = {
            muted: false,
            unlocked: false,
            volume: 1,
            channel1: null,
            lastEventAt: {},
            playLog: [],
            skippedLog: []
        };

        if (typeof localStorage !== "undefined") {
            try {
                state.muted = localStorage.getItem(STORAGE_MUTE_KEY) === "1";
            } catch (err) {
                state.muted = false;
            }
        }

        function channelBusy() {
            if (!state.channel1) return false;
            if (playingAdapter.isPlaying(state.channel1.id)) return true;
            if (state.channel1.until > nowMs()) return true;
            return false;
        }

        function stopChannel1() {
            if (stopAdapter.stop) {
                stopAdapter.stop(state.channel1 ? state.channel1.id : null);
            }
            state.channel1 = null;
        }

        function play(soundId, reason) {
            if (!soundId) {
                state.skippedLog.push({ soundId: soundId, reason: "empty" });
                return false;
            }
            if (!state.unlocked) {
                state.skippedLog.push({ soundId: soundId, reason: "locked-autoplay" });
                return false;
            }
            if (state.muted) {
                state.skippedLog.push({ soundId: soundId, reason: "muted" });
                return false;
            }
            if (Parity.isIdleGated(soundId) && channelBusy()) {
                state.skippedLog.push({ soundId: soundId, reason: "channel1-busy" });
                return false;
            }

            stopChannel1();
            const handle = playAdapter.play(soundId, { volume: state.volume }) || {};
            const durationMs = typeof handle.durationMs === "number" ? handle.durationMs : 0;
            state.channel1 = {
                id: soundId,
                until: nowMs() + Math.max(durationMs, 16)
            };
            const rec = { soundId: soundId, reason: reason || "", at: nowMs() };
            state.playLog.push(rec);
            state.lastEventAt[soundId] = rec.at;
            return true;
        }

        function playEvent(eventKey, extra) {
            extra = extra || {};
            switch (eventKey) {
                case "throw":
                    return play(Parity.throwSoundId(extra.power), "throw");
                case "person_impact":
                    return play("hit1", "person_impact");
                case "ground_land":
                    return play("splat", "ground_land");
                case "walk_step":
                    return play("step", "walk_step");
                case "red_stun":
                    return play("bird_tweets", "red_stun");
                case "red_death":
                    return play("ahhhh", "red_death");
                case "green_second_hit":
                    return play("hit2", "green_second_hit");
                case "green_death": {
                    const n = extra.kidsIndex || (1 + Math.floor(Math.random() * 3));
                    return play(Parity.kidsDeathSoundId(n), "green_death");
                }
                case "dead_hover":
                    return play("short_chirps", "dead_hover");
                case "level_clear":
                    return play(Parity.levelClearSoundId(extra.mouseH), "level_clear");
                case "game_over":
                    return play("laugh", "game_over");
                default: {
                    const neverEvent = eventKey;
                    void neverEvent;
                    state.skippedLog.push({ soundId: eventKey, reason: "unknown-event" });
                    return false;
                }
            }
        }

        function setMuted(muted) {
            state.muted = !!muted;
            if (state.muted) {
                stopAll();
            }
            if (typeof localStorage !== "undefined") {
                try {
                    localStorage.setItem(STORAGE_MUTE_KEY, state.muted ? "1" : "0");
                } catch (err) {
                    /* ignore quota / private mode */
                }
            }
        }

        function unlock() {
            state.unlocked = true;
            if (unlockAdapter.unlock) {
                unlockAdapter.unlock();
            }
            return true;
        }

        function stopAll() {
            stopChannel1();
            if (stopAdapter.stopAll) {
                stopAdapter.stopAll();
            }
        }

        function restart() {
            stopAll();
            state.playLog = [];
            state.skippedLog = [];
            state.lastEventAt = {};
        }

        // nextLevel / ridicule: repeat while soundBusy(1).
        function whenIdle(fn, schedule) {
            const wait = typeof schedule === "function"
                ? schedule
                : function (cb) { setTimeout(cb, 50); };
            function tick() {
                if (!channelBusy()) fn();
                else wait(tick);
            }
            tick();
        }

        return {
            STORAGE_MUTE_KEY,
            play: play,
            playEvent: playEvent,
            setMuted: setMuted,
            isMuted: function () { return state.muted; },
            unlock: unlock,
            isUnlocked: function () { return state.unlocked; },
            stopAll: stopAll,
            restart: restart,
            whenIdle: whenIdle,
            isChannelBusy: channelBusy,
            getPlayLog: function () { return state.playLog.slice(); },
            getSkippedLog: function () { return state.skippedLog.slice(); },
            getState: function () {
                return {
                    muted: state.muted,
                    unlocked: state.unlocked,
                    volume: state.volume,
                    channel1: state.channel1
                };
            }
        };
    }

    function createPhaserAdapter(scene) {
        return {
            play: function (soundId, opts) {
                if (!scene || !scene.sound) return { durationMs: 0 };
                if (scene.sound.locked) return { durationMs: 0 };
                const key = "sfx_" + soundId;
                if (!scene.cache.audio.exists(key) && !scene.sound.get(key)) {
                    return { durationMs: 0 };
                }
                const snd = scene.sound.play(key, {
                    volume: opts && typeof opts.volume === "number" ? opts.volume : 1,
                    detune: 0,
                    rate: 1
                });
                let durationMs = 0;
                if (snd && typeof snd.duration === "number") {
                    durationMs = snd.duration * 1000;
                }
                return { durationMs: durationMs, handle: snd };
            },
            stop: function () {
                if (!scene || !scene.sound) return;
                const playing = scene.sound.getAllPlaying ? scene.sound.getAllPlaying() : [];
                playing.forEach(function (snd) {
                    if (snd && snd.key && snd.key.indexOf("sfx_") === 0 && snd.stop) {
                        snd.stop();
                    }
                });
            },
            stopAll: function () {
                if (scene && scene.sound && scene.sound.stopAll) {
                    scene.sound.stopAll();
                }
            },
            isPlaying: function () {
                if (!scene || !scene.sound) return false;
                const playing = scene.sound.getAllPlaying ? scene.sound.getAllPlaying() : [];
                return playing.some(function (snd) {
                    return snd && snd.key && snd.key.indexOf("sfx_") === 0;
                });
            },
            unlock: function () {
                if (scene && scene.sound && scene.sound.unlock) {
                    scene.sound.unlock();
                }
            }
        };
    }

    return {
        createSnowcraftAudio: createSnowcraftAudio,
        createPhaserAdapter: createPhaserAdapter,
        STORAGE_MUTE_KEY: STORAGE_MUTE_KEY
    };
});
