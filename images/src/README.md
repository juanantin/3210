# Originals

The artwork as it was handed over, kept so every derived file can be remade.
Nothing in here is served by the page.

| File | What it is | What comes from it |
|---|---|---|
| `header_master.mp4` | The $3310 header clip: 1620×1080 (3:2), 5s, 30fps, no audio | `images/header.mp4` (H.264), `images/header.webm` (VP9), both 1080×720, and `images/header_poster.webp` (its own first frame) |
| `header_still_master.webp` | The same header as a still, 810×540 | `images/social.jpg` (the header whole at 630px tall, centred on a 40px-blurred stretch of itself out to 1200×630, its sides feathered over 60px), and every icon — the phone's head (a 270px circle centred at 405,150) cut to a transparent circle: `favicon.ico`, `images/favicon.png`, `icon-192`, `icon-512`, and `apple-touch-icon` on #000e27 |

Remaking the header files needs ffmpeg:

```bash
ffmpeg -i images/src/header_master.mp4 -map 0:v:0 -an -vf scale=1080:720:flags=lanczos \
       -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart images/header.mp4
ffmpeg -i images/src/header_master.mp4 -map 0:v:0 -an -vf scale=1080:720:flags=lanczos \
       -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 images/header.webm
ffmpeg -i images/src/header_master.mp4 -frames:v 1 -vf scale=1080:720 first.png   # → header_poster.webp
```

`images/phone.webp` was cut out of a studio photo of the phone (480×1168
after cropping); the game's LCD and key positions in
`assets/js/snake/phone.js` are measured in its pixels.

`images/stonkex_button.png` and `images/stockify_logo.png` come from the
$BLUE repo with their dark wordmark pixels (right of each icon) turned white
for the dark page.
