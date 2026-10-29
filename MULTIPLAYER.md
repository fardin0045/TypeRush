# TypeFight: play a friend

Both players must open the same deployed HTTPS website, then TypeFight → Play a friend.

1. Host chooses a difficulty and clicks **Create room**.
2. Share the four-character code privately, for example K7MP.
3. Friend enters it in **Enter room code** and clicks **Join room**.
4. The handshake happens automatically and the countdown starts once both browsers connect.

No reply code, account, API key or database setup is needed. Keep both tabs visible while playing. A hidden tab pauses the match. After a match, the host selects **New match** to start a rematch.

## How it works

PeerJS Cloud (https://0.peerjs.com and wss://0.peerjs.com) provides the free shared signaling service. It maps the short code to the host and exchanges connection details automatically. Google STUN helps discover network addresses. Game state travels directly between browsers over WebRTC. Scores are not stored on the service. Rooms are scoped to the website origin: use the same production website, not different preview URLs.

This depends on a public shared service. Its availability is outside this project's control. PeerJS recommends a dedicated PeerServer for high traffic. There is no TURN relay: some mobile, corporate, VPN and restrictive NAT networks cannot connect directly. Short codes simplify joining but do not remove that network limitation.

Official references: https://peerjs.com/server/cloud and https://peerjs.com/client/faq

## Timeouts and retry

- Creating a room has a 15-second service timeout.
- Waiting rooms expire after five minutes.
- Connecting to an opponent times out after 30 seconds.
- Leaving, refreshing or closing the host's tab closes the room. Use **Start over** and create a fresh room.
- If the network blocks the connection, try a different Wi-Fi or disable a VPN.

Only two players are accepted. Codes use cryptographic randomness; collisions are retried. Four characters are an invitation convenience, not a password: anyone who guesses or receives the code could join first. Share only with your friend. The signaling service receives connection metadata; WebRTC peers can learn network addresses.

## Fair play and storage

The host runs the authoritative simulation. Matches are casual, not tamper-proof ranked play, and latency can favor the host. Multiplayer results are not added to solo records. There is no global leaderboard.

## Deploy and verify

Push the updated source, package.json, package-lock.json, vercel.json and public/_headers to GitHub and redeploy Vercel. No environment variables are needed. Cloudflare Pages also works with the new release ZIP. Both header configurations now permit the specific PeerJS signaling endpoint.

npm run check tests real short-code joining, automatic start, gameplay, rematch, disconnect and mobile layout against the public service. This requires internet access and an available PeerJS Cloud service. It does not guarantee connectivity across every network. Test two physical devices on different networks after publishing.
