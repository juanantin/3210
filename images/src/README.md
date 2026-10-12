# Originals

The artwork as it was handed over, kept so every derived file can be remade.
Nothing in here is served by the page.

| File | What it is | What comes from it |
|---|---|---|
| `header_master.mp4` | The $3310 header clip: 1620×1080 (3:2), 5s, 30fps, no audio | `images/header.mp4` (H.264), `images/header.webm` (VP9), both 1080×720 and blended into the page through `header_mask.png`, and `images/header_poster.webp` (the blended clip's first frame) |
| `header_mask.png` | 1080×720 greyscale: white keeps the clip, black is the page navy #000e27 | A wide fade on every side (17% left and right, 11% top, 24% bottom), lifted back to full wherever the clip has type — BASE top-left, $3310 and its line, BUY $3310 — found as the pixels brighter than 150–215 across six frames, kept to the side regions so the beams above and below the phone still fade, then grown 3px and softened. Baked into the video, so the page needs no CSS mask and there is no edge to see |
| `header_still_master.webp` | The same header as a still, 810×540 | `images/social.jpg` (the header whole at 630px tall, centred on a 40px-blurred stretch of itself out to 1200×630, its sides feathered over 60px), and every icon — the phone's head (a 270px circle centred at 405,150) cut to a transparent circle: `favicon.ico`, `images/favicon.png`, `icon-192`, `icon-512`, and `apple-touch-icon` on #000e27 |

Remaking the header files needs ffmpeg:

```bash
# the clip, over the page navy, through the mask; -t keeps the looped mask from running on
BLEND='[0:v]scale=1080:720:flags=lanczos,format=rgba[v];[1:v]format=gray,fps=30[m];[v][m]alphamerge[va];[2:v][va]overlay=shortest=1,format=yuv420p[out]'
IN='-i images/src/header_master.mp4 -loop 1 -t 5 -i images/src/header_mask.png -f lavfi -t 5 -i color=c=0x000e27:s=1080x720:r=30'
ffmpeg $IN -filter_complex "$BLEND" -map '[out]' -an -t 5 \
       -c:v libx264 -crf 23 -preset medium -movflags +faststart images/header.mp4
ffmpeg $IN -filter_complex "$BLEND" -map '[out]' -an -t 5 \
       -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 images/header.webm
ffmpeg -i images/header.mp4 -frames:v 1 first.png   # → header_poster.webp
```

`images/phone.webp` was cut out of a studio photo of the phone (480×1168
after cropping); the game's LCD and key positions in
`assets/js/snake/phone.js` are measured in its pixels.

`images/stonkex_button.png` and `images/stockify_logo.png` come from the
$BLUE repo with their dark wordmark pixels (right of each icon) turned white
for the dark page.
