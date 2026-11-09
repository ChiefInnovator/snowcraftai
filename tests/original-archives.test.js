const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..", "docs", "reference", "snowcraft-original");

function sha256(rel) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    return crypto.createHash("sha256").update(buf).digest("hex");
}

describe("docs/reference/snowcraft-original archives", () => {
    it("keeps both original-game zips, the sounds pack, EXE, and DCR at pinned SHA-256", () => {
        const pins = {
            "archives/nicholson-snowcraft-1999-win32-projector-ia-snowcraft-201912.zip":
                "2aa0f56411608c4b7a986f4f267b83b4ce26c9c51ca6dea6d15d4f9c5718bf0e",
            "archives/nicholson-snowcraft-1999-shockwave-afterburner-dcr.zip":
                "e03a0065da466117a66d5d4d0ab7ee45bd95f00e439371622cd34dc7b7150956",
            "archives/nicholson-snowcraft-1999-extracted-sounds-pack.zip":
                "da86b1940094f89a735447f3e237926b771f1a5d9a025c2b77a69c2134f02cfa",
            "extracted/SnowCraft.exe":
                "2103bae31937095450962c91ec025e5e49eac920d2eccf1bdd89bcae2e130b8c",
            "extracted/snowcraft.dcr":
                "dbef86d17467b9e24e6e4a4227bc9c5d7aa8c3cb12e2f4f21722a5fc68380fa9"
        };
        for (const [rel, expected] of Object.entries(pins)) {
            assert.equal(sha256(rel), expected, rel);
        }
    });

    it("records Cursor upload filenames in SOURCE-PROVENANCE.json", () => {
        const prov = JSON.parse(fs.readFileSync(path.join(ROOT, "SOURCE-PROVENANCE.json"), "utf8"));
        const uploads = Object.fromEntries(prov.uploads.map((u) => [u.role, u.cursor_upload_filename]));
        assert.equal(
            uploads["win32-director-8-projector-archive"],
            "ba07317d50dbd20f8eb820ebb8055b5a5317fad5a8a09f3926094d9d0ac94bc4_52b2.zip"
        );
        assert.equal(
            uploads["shockwave-afterburner-dcr-archive"],
            "61ba897b0470a9c0005f5d759bd8d8b7ed6041ab062dfbb1866cc655d4cc4351_d17c.zip"
        );
        assert.equal(uploads["extracted-sounds-pack"], "application-sounds_995b.zip");
        assert.equal(prov.note.includes("never executed"), true);
    });

    it("has a SHA256MANIFEST that matches every listed file", () => {
        const lines = fs.readFileSync(path.join(ROOT, "SHA256MANIFEST.txt"), "utf8").trim().split("\n");
        assert.ok(lines.length >= 25);
        for (const line of lines) {
            const [hash, rel] = line.split("  ");
            assert.equal(sha256(rel), hash, rel);
        }
    });

    it("records exact original copyright strings and does not invent a license", () => {
        const notices = fs.readFileSync(path.join(ROOT, "COPYRIGHT-NOTICES.md"), "utf8");
        const rootNotice = fs.readFileSync(path.join(__dirname, "..", "NOTICE.md"), "utf8");
        assert.match(notices, /wells packard - Nicholson \| NY/);
        assert.equal(notices.includes("wells packard - Nicholson | NY"), true);
        assert.match(notices, /wells packard - Icon Nicholson/);
        assert.match(notices, /Wells Packard - Nicholson NY/);
        assert.match(notices, /Copyright 1985-2000 Macromedia, Inc\./);
        assert.match(notices, /Copyright 1989-95 MacroMedia, Inc\. All rights reserved\./);
        assert.match(notices, /Happy Holidays/);
        assert.match(notices, /IconMedialab/);
        assert.match(notices, /kchui@nny\.com/);
        assert.match(notices, /flashgamenet_0-999/);
        assert.match(notices, /How to play/);
        assert.match(notices, /explicit license grant/);
        assert.match(rootNotice, /No explicit license, EULA, or redistribution permission for SnowCraft was/);
        assert.equal(rootNotice.includes("MIT License"), false);
        assert.equal(notices.includes("licensed under MIT"), false);
    });
});
