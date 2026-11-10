// Page behaviour outside the game: choosing the 1999 or 2026 artwork, comparing
// the two, and sending the card on.
(function () {
    'use strict';

    // ---- 1999 / 2026 ----
    // The game owns the artwork setting through #artwork-select and mirrors the
    // chosen value on #game-container[data-artwork]. The page only drives that
    // select and reflects what the game reports back.
    const artworkSelect = document.getElementById('artwork-select');
    const container = document.getElementById('game-container');
    const editions = Array.from(document.querySelectorAll('.edition input'));
    const plateWipe = document.querySelector('.plate-wipe');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    let wipeRun = 0;

    function reflectEdition() {
        const value = (container && container.dataset.artwork) || (artworkSelect && artworkSelect.value);
        editions.forEach(input => {
            input.checked = input.value === value;
            input.closest('.edition').classList.toggle('is-on', input.checked);
        });
        document.documentElement.dataset.edition = value === 'original' ? '1999' : '2026';
    }

    function applyEdition(value) {
        if (!artworkSelect || artworkSelect.value === value) return;
        artworkSelect.value = value;
        artworkSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function drawnEdition() {
        const scene = window.SnowcraftGame && window.SnowcraftGame.getScene();
        return scene && scene.artwork ? scene.artwork.mode : null;
    }

    // Cover the game with the year, change the artwork underneath, then uncover
    // once the game is really drawing it (the 2026 pack may still be loading).
    function switchEdition(value) {
        if (!artworkSelect) return;
        if (artworkSelect.value === value) { reflectEdition(); return; }
        if (!plateWipe || (reducedMotion && reducedMotion.matches) || !plateWipe.getClientRects().length) {
            applyEdition(value);
            return;
        }
        const run = ++wipeRun;
        plateWipe.dataset.year = value === 'original' ? '1999' : '2026';
        plateWipe.classList.remove('is-leaving');
        plateWipe.classList.add('is-covering');
        setTimeout(() => {
            if (run !== wipeRun) return;
            applyEdition(value);
            const started = performance.now();
            (function uncover() {
                if (run !== wipeRun) return;
                // Hold the sheet long enough to read the year, and until the game has switched.
                const waited = performance.now() - started;
                if (waited < 460 || (drawnEdition() !== value && waited < 20000)) { requestAnimationFrame(uncover); return; }
                plateWipe.classList.add('is-leaving');
                plateWipe.classList.remove('is-covering');
                setTimeout(() => { if (run === wipeRun) plateWipe.classList.remove('is-leaving'); }, 400);
            })();
        }, 270);
    }

    editions.forEach(input => input.addEventListener('change', () => { if (input.checked) switchEdition(input.value); }));
    document.querySelectorAll('[data-edition]').forEach(button => button.addEventListener('click', () => {
        const play = document.getElementById('play');
        if (play) play.scrollIntoView({ block: 'center', behavior: reducedMotion && reducedMotion.matches ? 'auto' : 'smooth' });
        switchEdition(button.dataset.edition);
    }));
    if (container && window.MutationObserver) {
        new MutationObserver(reflectEdition).observe(container, { attributes: true, attributeFilter: ['data-artwork'] });
    }
    reflectEdition();

    // ---- Drag the line across the two printings ----
    document.querySelectorAll('[data-wipe]').forEach(wipe => {
        const range = wipe.querySelector('.wipe-range');
        if (!range) return;
        const set = () => wipe.style.setProperty('--split', range.value + '%');
        range.addEventListener('input', set);
        set();
    });

    // ---- Sending the card on ----
    const PAGE_URL = 'https://chiefinnovator.github.io/snowcraftai/';
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const status = document.querySelector('.share-status');

    function shareText() {
        // A finished game puts its score in the message.
        try {
            const scene = window.SnowcraftGame && window.SnowcraftGame.getScene();
            if (scene && scene.playAgainButton && scene.playAgainButton.visible && scene.score > 0) {
                return 'I scored ' + scene.score + ' in SnowCraft, the 1999 snowball fight. Your turn.';
            }
        } catch (err) { /* the game is still loading */ }
        return 'SnowCraft, the 1999 snowball fight, is back. It plays in your browser.';
    }

    // Cancel the envelopes with today's postmark.
    function stamp() {
        const now = new Date();
        document.querySelectorAll('[data-sent-day]').forEach(el => { el.textContent = now.getDate() + ' ' + MONTHS[now.getMonth()]; });
        document.querySelectorAll('[data-sent-year]').forEach(el => { el.textContent = String(now.getFullYear()); });
        document.querySelectorAll('.postmark-sent').forEach(el => {
            el.classList.remove('is-struck');
            void el.getBoundingClientRect();
            el.classList.add('is-struck');
        });
    }

    function say(button, message) {
        const label = button.querySelector('[data-share-label]');
        if (label) {
            if (!label.dataset.rest) label.dataset.rest = label.textContent;
            label.textContent = message;
            clearTimeout(button.restTimer);
            button.restTimer = setTimeout(() => { label.textContent = label.dataset.rest; }, 2600);
        }
        if (status) status.textContent = message;
    }

    async function copyLink(button) {
        try {
            await navigator.clipboard.writeText(PAGE_URL);
            say(button, 'Link copied');
        } catch (err) {
            // No clipboard access: leave the address selected so it can be copied by hand.
            const address = document.querySelector('.address');
            if (address) {
                const range = document.createRange();
                range.selectNodeContents(address);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                address.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            say(button, 'Copy the address');
        }
        stamp();
    }

    async function share(button) {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Snowcraft Reforged', text: shareText(), url: PAGE_URL });
                say(button, 'Sent');
                stamp();
            } catch (err) {
                // Closing the share sheet is not an error; anything else falls back to the clipboard.
                if (!err || err.name !== 'AbortError') await copyLink(button);
            }
            return;
        }
        await copyLink(button);
    }

    document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', () => share(button)));
    document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => copyLink(button)));
})();
