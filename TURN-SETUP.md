# Enable relay connections on Vercel

## No-card option: Metered / Open Relay

Cloudflare may require a payment method before activating TURN even within its free allowance. If you do not have one, use Metered instead:

1. Open https://www.metered.ca/tools/openrelay/ and choose the free signup option.
2. In the dashboard, locate your TURN credentials/API settings. Copy the app domain (such as `yourapp.metered.live`) and the TURN REST API key. This is not a realtime messaging publishable key.
3. In Vercel → project → Settings → Environment Variables → Production, add `METERED_TURN_DOMAIN` (hostname only, no https:// or path) and `METERED_TURN_API_KEY` (secret).
4. Push the updated project including `api/ice.js`, then redeploy Vercel. These variables select Metered instead of Cloudflare; Cloudflare credentials are not required.
5. Both players refresh, enable **Use relay only**, and create/join a new room to verify the relay.

Metered advertises no credit card required. Its Open Relay page advertises 20 GB/month, while its main TURN pricing page currently shows a 500 MB monthly free trial. Confirm the allowance actually assigned to your account in the dashboard; do not assume 20 GB or select a paid plan. The website stays on Vercel.

The TURN REST API key stays on Vercel. The returned TURN username/password must reach the browser for WebRTC; their lifetime is controlled by Metered, not by this endpoint. Actual relay routing cannot be tested until your account is configured.

Sources: https://www.metered.ca/tools/openrelay/ and https://www.metered.ca/stun-turn

If one friend connects and another cannot, their browser/network combination may block direct WebRTC. Four-character room codes and connection retries cannot bypass every firewall. TURN provides an alternate path through a relay server.

## One-time account setup

1. Sign into https://dash.cloudflare.com/ and find **Realtime → TURN** (use dashboard search for TURN if the menu differs).
2. Create a TURN key for TypeFight. Keep both the **TURN key ID** and its **API token**. Use the token associated with the TURN key, not a global Cloudflare API key.
3. Open your **typecheker** project on Vercel → **Settings → Environment Variables**.
4. Add `TURN_KEY_ID` with the key ID and `TURN_KEY_API_TOKEN` with its API token. Select **Production**. Mark the token secret/sensitive when the dashboard offers that setting. Add Preview separately only if you need to test previews.
5. Do not add a `VITE_` prefix. Do not put the token in source code, GitHub, browser settings or chat.
6. Commit/push the updated project, including the new **api/ice.js** function, client files and package.json, then redeploy. Adding variables alone does not update an existing deployment.
7. Both players reload the same production site. Create a new room. Under the room, **Relay available for restricted networks** confirms the credential service is configured. It does not mean the selected connection is necessarily relayed; direct connections are still preferred by default.
8. To verify relay use, enable **Use relay only** on both devices before creating/joining a room. If the match starts, the connection used TURN. Then disable the option for ordinary play so WebRTC can choose the best path.

The site remains hosted on Vercel. You do not need to move the site or its domain to Cloudflare. Cloudflare supplies only TURN credentials and relay bandwidth.

## Cost and limits

Cloudflare currently includes 1,000 GB in the Realtime free allowance shared between SFU and TURN. Usage above the allowance is billed at $0.05/GB; this is not unlimited free hosting. Review account terms and usage in the dashboard and set available billing/usage alerts before enabling it publicly. Do not opt into paid extras merely to follow this guide.

The credential endpoint is intended for this casual, anonymous game. It rejects cross-origin browser requests and issues short-lived credentials, but it is not an authenticated quota system: non-browser clients can imitate request headers. Configure platform rate limiting for `/api/ice` and monitor provider usage before broader promotion. Never rely on an in-memory serverless counter as a global spending cap.

## Behavior and troubleshooting

- The backend generates temporary credentials with a two-hour lifetime. Start a fresh room after long sessions; this version does not renew active relay credentials automatically.
- **Direct connection only — relay has not been configured**: one or both Vercel variables are missing. Add them to the deployment environment and redeploy.
- **Relay service unavailable**: check the TURN key/token, provider availability and Vercel function logs. The app can still try a direct connection, but relay-only mode stops with a clear message.
- **Relay available**, but joining still fails: keep both tabs visible, turn off a VPN or try another network/browser. TURN improves compatibility but cannot guarantee access through every firewall.
- Existing short room codes and automatic start are unchanged.
- A static Cloudflare ZIP upload does not deploy `api/ice.js`. To use this implementation, deploy the source project to Vercel. `vite dev` alone also does not run the function; use Vercel's local development environment for relay testing.

## Security and verification

The long-term token is read only by the Vercel function. The browser receives temporary ICE credentials. Responses use `Cache-Control: no-store, private`. Neither secrets nor issued credentials are logged. The provider request has an eight-second timeout.

Automated tests cover missing configuration, cross-origin rejection, safe provider failures, credential filtering, and client relay-only settings. Without your actual Cloudflare credentials we cannot verify real TURN routing. Complete step 8 with the friend whose connection failed before treating the network issue as resolved.

Official documentation:
- https://developers.cloudflare.com/realtime/turn/generate-credentials/
- https://developers.cloudflare.com/realtime/turn/faq/
- https://vercel.com/docs/functions/runtimes/node-js
