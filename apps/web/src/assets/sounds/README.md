# Sounds

Sound files of the app (`docs/features/sounds.md`). All are by Kenney (kenney.nl), license CC0 (public domain, no credit needed).

Sources:

- Casino Audio 1.1: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
  - `dice-throw-1..3`, `chip-lay-1..3`, `chips-stack-1..3`
- Interface Sounds: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
  - `bong_001`, `question_001`

The zips have `.ogg` files. Each one is converted to mono `.mp3` (Safari decodes it), 44.1 kHz, small:

```sh
ffmpeg -i <name>.ogg -ac 1 -ar 44100 -codec:a libmp3lame -q:a 6 <name>.mp3
```
