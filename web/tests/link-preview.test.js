// The page must always carry a working link preview: Open Graph and Twitter
// tags that point at a real 1200x630 image shipped with the site.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const SITE = "https://chiefinnovator.github.io/snowcraftai/";

function meta(key) {
    const match = html.match(new RegExp('<meta (?:property|name)="' + key + '" content="([^"]*)"'));
    return match ? match[1] : null;
}

test("every link-preview tag is present and filled in", () => {
    for (const key of ["og:type", "og:site_name", "og:title", "og:description", "og:url", "og:image", "og:image:width",
        "og:image:height", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
        assert.ok(meta(key), key + " is missing or empty");
    }
    assert.equal(meta("og:url"), SITE);
    assert.equal(meta("twitter:card"), "summary_large_image");
    assert.equal(meta("twitter:image"), meta("og:image"));
});

test("the preview image is an absolute site URL to a shipped 1200x630 JPEG", () => {
    const url = meta("og:image");
    assert.ok(url.startsWith(SITE), "preview image must be an absolute URL on the site: " + url);
    const file = path.join(root, url.slice(SITE.length));
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length > 20000 && bytes.length < 1000000, "unexpected preview size: " + bytes.length);
    assert.deepEqual([bytes[0], bytes[1]], [0xff, 0xd8], "preview is a JPEG");
    // Read the frame size from the first start-of-frame marker.
    let at = 2, width = 0, height = 0;
    while (at < bytes.length) {
        const marker = bytes[at + 1], size = bytes.readUInt16BE(at + 2);
        if (marker >= 0xc0 && marker <= 0xc3) { height = bytes.readUInt16BE(at + 5); width = bytes.readUInt16BE(at + 7); break; }
        at += 2 + size;
    }
    assert.deepEqual([width, height], [1200, 630]);
    assert.deepEqual([meta("og:image:width"), meta("og:image:height")], ["1200", "630"]);
});
