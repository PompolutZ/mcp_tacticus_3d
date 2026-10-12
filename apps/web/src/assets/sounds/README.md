# Sounds

Sound files of the app (`docs/features/sounds.md`).

| Files | Source | License |
|---|---|---|
| `shake-1..16` | The user's recording "New Recording 2": 5 dice shaken in a hand | The user's own |
| `die-hit-1..16` | The user's recording "New Recording": one die dropped on the mat | The user's own |
| `model-terrain-1..11` | The user's recording "New Recording 4", second part: a model put on a plastic terrain piece. Version "Soft 1". | The user's own |
| `model-mat-1` | Freesound 556387 "Moving piece on a boardgame" by zachrau, hit 2. Until the user records the mat again. | CC0 |
| `ping-bing` | Freesound 220212 "Ping Bing" by GameAudio | CC0 |
| `chip-lay-1..3`, `chips-stack-1..3` | Kenney, Casino Audio 1.1 (kenney.nl) | CC0 |
| `question_001` | Kenney, Interface Sounds (kenney.nl) | CC0 |

CC0 is public domain, no credit needed.

## Own recordings

iPhone Voice Memos, AAC 48 kHz, made on 2026-10-12. The originals stay with the user.

Every file is mono, `highpass=f=80`, 44.1 kHz, `libmp3lame -q:a 6`:

```sh
ffmpeg -ss <start> -t <length> -i <recording> -ac 1 -ar 44100 -af "highpass=f=80,..." -codec:a libmp3lame -q:a 6 <name>.mp3
```

- Each hit is cut at a sharp rise of loudness, made equally loud (peak -3 dB), with a 15 ms fade out.
- "Soft 1" (`model-terrain`) also has `lowpass=f=3000` and -6 dB, with a 30 ms fade out.

Cut times, `start/length` in seconds:

- `shake-1..16` (New Recording 2): 3.380/0.198, 9.330/0.098, 10.438/0.234, 13.222/0.190, 13.688/0.166, 17.988/0.220, 18.404/0.246, 18.890/0.216, 20.230/0.244, 21.676/0.104, 23.662/0.242, 25.058/0.162, 26.912/0.078, 28.062/0.212, 29.920/0.300, 30.876/0.162.
- `die-hit-1..16` (New Recording): 7.452/0.140, 10.244/0.202, 13.222/0.116, 16.598/0.212, 19.070/0.300, 21.640/0.148, 24.534/0.210, 27.424/0.118, 31.080/0.194, 31.506/0.114, 33.986/0.140, 36.758/0.198, 39.388/0.184, 43.484/0.166, 48.982/0.156, 51.892/0.160.
- `model-terrain-1..11` (New Recording 4): starts 27.464, 28.852, 29.694, 30.318, 30.926, 32.274, 33.054, 33.634, 34.404, 35.192, 38.358, each 0.300 long.

## Freesound files

Freesound gives the original file only after a login. The previews (128 kbps mp3) are good enough for these short sounds.

- `model-mat-1`: https://cdn.freesound.org/previews/556/556387_676927-hq.mp3, `-ss 2.899 -t 0.064`, 20 ms fade out.
- `ping-bing`: https://cdn.freesound.org/previews/220/220212_4100837-hq.mp3, whole.

## Kenney files

- Casino Audio 1.1: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- Interface Sounds: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip

The zips have `.ogg` files. Each one is converted to mono `.mp3` (Safari decodes it), 44.1 kHz, small:

```sh
ffmpeg -i <name>.ogg -ac 1 -ar 44100 -codec:a libmp3lame -q:a 6 <name>.mp3
```
