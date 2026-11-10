# Santa's magical disappearance

Santa keeps his existing entrance, wink and wave. At his greeting spot beside
the Christmas grove he twitches his nose for 0.9 seconds, then performs a
1.7-second spell. Spiralling gold light and icy sparkles gather around him;
a white-gold starburst hides his instantaneous disappearance 520 ms into the
spell. His cast shadow and boot contacts disappear at the same instant. The
sparkles expand and drift upward afterward. He does not run across the field.

`classic/nose-cycle.png` and `hd/nose-cycle.png` each contain left, centre and
right nose poses with a stationary body. Exact built-in image-generation prompts,
references and provenance are in `generation.json`. Earlier approved sources
remain in the v2 and original directories.

Rebuild with `node tools/artwork/build-santa.mjs`. Schema 3 exports 24 poses per
style, pose shadows and grove masks (122 runtime PNGs). Spell glows, ribbons and
stars are native renderer effects in `web/js/santa.js`; Original mode uses pixel
crosses and HD uses smooth four-point stars. All effects share Santa's independent
clock, clear between visits and are removed on scene shutdown.

[`../preview.mp4`](../preview.mp4) is an 8.4-second, 60 fps recording of the actual
composited game, cropped around the grove. Original is on the left, HD on the
right. It shows the whole visit and the clear field afterward.

Validation receipts are in `validation.json`. Gameplay rules and player animation
are outside this change.
