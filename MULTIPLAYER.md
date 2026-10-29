# Play TypeFight with a friend

Open TypeFight and select **Play a friend**, or visit `/#/fight/friend` on the deployed HTTPS site. Both players use their own device and keyboard.

1. Host: choose the difficulty and select **Create invite**. Copy the invite code and send it privately to your friend.
2. Friend: paste the invite into **Or paste an invite code**, then select **Join with invite**.
3. Friend: copy the reply code and send it back to the host.
4. Host: paste it into **Friend’s reply code** and select **Connect to friend**.
5. Friend selects **I’m ready**, then the host selects **Start match**.

Both players receive the same word. Each correct letter alternates punching hands; the first to finish the word earns the kick. Backspace clears a mistake. Either player can block, dodge, pause or resume. The host can offer a new match after the finish; the friend must ready up again. Solo AI modes remain available.

## Connection and privacy

No application backend, database, account, room registry or signaling service is used. The two codes carry the connection information manually. A public Google STUN service (`stun.l.google.com:19302`) helps discover network addresses; match data travels through a WebRTC data channel between the browsers. There is no TURN relay. Some mobile, corporate, VPN or restrictive NAT networks will not connect directly. Try the same Wi-Fi or another network and create new codes if connection fails.

Codes can contain network-address information. Share them only with the intended opponent. Keep both game tabs open and visible. Changing tabs pauses the match; refreshing, navigating away or leaving closes the connection. To reconnect, start over with fresh codes.

This is a friendly host-authoritative match, not a tamper-proof ranked service. The host processes inputs in arrival order, so latency can favor the host. Multiplayer results are not added to solo local records. No camera or microphone access is requested.

## Verification

`npm run check` builds and tests the production site, then connects two isolated browser sessions using real offer/reply codes. It verifies validation, matching words, remote input, mistakes, pause/resume, guest victory, rematch, disconnection and a mobile viewport. A successful local two-browser test does not guarantee connectivity across every real-world network. Test the public HTTPS URL on both intended devices after deployment.

WebRTC connectivity reference: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
