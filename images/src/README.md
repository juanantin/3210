# Originals

The artwork as it was handed over, kept so every derived file can be remade.
Nothing in here is served by the page.

| File | What it is | What comes from it |
|---|---|---|
| `header_master.mp4` | The header clip as delivered: 672×448, 10s, 24fps, with an audio track and a cover image | `images/header.mp4`, `images/header.webm` and `images/header_poster.webp` (its own first frame) |
| `banner_master.jpg` | The $3310 banner, 1500×500 | `images/social.jpg` — the banner on 1200×630, its top and bottom rows extended and faded to #000e27 |
| `token_master.webp` | The $3310 coin on transparency, 1254×1254 | `images/favicon.png`, `icon-192`, `icon-512`, `apple-touch-icon` (on #000e27) and `/favicon.ico` — trimmed to the coin's alpha bounds first |

`images/phone.webp` was cut out of a studio photo of the phone (480×1168
after cropping); the game's LCD and key positions in
`assets/js/snake/phone.js` are measured in its pixels.

`images/stonkex_button.png` and `images/stockify_logo.png` come from the
$BLUE repo with their dark wordmark pixels (right of each icon) turned white
for the dark page.

Remaking the header files needs ffmpeg:

```bash
ffmpeg -i images/src/header_master.mp4 -map 0:v:0 -an \
       -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart \
       images/header.mp4
ffmpeg -i images/src/header_master.mp4 -map 0:v:0 -an \
       -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 images/header.webm
ffmpeg -i images/src/header_master.mp4 -map 0:v:0 -frames:v 1 first.png   # → header_poster.webp
```
