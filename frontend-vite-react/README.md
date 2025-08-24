# Midnight Rebels — Frontend

A Vite + React + TypeScript UI for a censorship‑resistant, community‑moderated news feed on Midnight TestNet. It integrates with a Compact contract (Rebels) to publish stories, vote on credibility, flag content, and build reputation.

## Quick start

- Requirements: Bun, a Midnight Lace-compatible wallet in the browser, TestNet access.
- Install and run:

```bash
bun install
bun run dev
```

The app runs with Vite HMR. Network is configured to Midnight TestNet.

## Configuration

Set these Vite env vars (prefix VITE_) in a .env or your host environment:

- VITE_REBELS_CONTRACT_ADDRESS — Rebels contract address. Defaults to a known test address in `src/config.ts`.
- VITE_DEBUG_UI — "true" to show extra debug UI. Default: false.
- VITE_DEFAULT_PROVER — "wallet" or a prover URL. Default: wallet.

The app can use either the wallet’s prover or a custom proof server (ps.midnames.com) toggled from the Debug screen.

## Architecture overview

- App shell: Vite + React 19 + TypeScript + Tailwind UI primitives.
- Providers: MidnightMeshProvider (wallet + network), WrappedPublicDataProvider, WrappedPrivateStateProvider, ZK config provider, proof provider, wallet + midnight providers for tx signing/submission.
- Contexts:
  - AppSettingsProvider — UI-level toggles, like custom proof server.
  - AuthProvider — in‑memory secret key and derived user info (never persisted).
- Contract lib: `src/lib/rebels.ts` wraps reads/writes to the Rebels contract and provides helpers (post listing, publish, vote, flag, referrals, user info, key derivation).
- Routes (React Router):
  - / — Headlines (Rebels)
  - /drop — Midnight Drop (curated links to important documents tagged as `drop`)
  - /create — Story editor/publisher
  - /story/:id — Full article view
  - /profile — Identity (secret key) + reputation
  - /debug — Network/prover debug utilities

## Functional description

### Headlines (/)

- Fetch and display posts from the Rebels contract, sorted by score (plus minus minus). Each card shows:
  - Title, optional image, and one‑line summary parsed from the post content format.
  - Score, + and − counts, author’s trust (reputation), and a link to “Read full story”.
  - Upvote/Downvote buttons and a Flag button (write ops require wallet + secret key).
- Connection banner indicates readiness:
  - No wallet: read‑only.
  - Wallet connected but providers warming: limited write until ready.
  - Fully ready: publish/vote/flag enabled.
- Your trust banner appears if a secret key is loaded in Profile (shows reputation and alias if available).
- Contract address chip shows the active contract (shortened).
- Floating flow status shows proving/signing/submission phases for transactions.
- Tabs:
  - Posts — the default feed.
  - Referrals — lets an authenticated user suggest new users. Includes a Secret‑Key→Public‑Key converter, a field to paste a public key, submit, and a counter of remaining referrals (max 2).

### Create (/create)

- Dedicated editor for composing a story while preserving on‑chain compatibility (single string). The composition format is:
  - First line: `# <title>`
  - Optional: `![image](<url>)`
  - Optional: `> <one line summary>`
  - Body: free text
- Live preview renders title, summary, image, and body; character count and a MAX check are shown.
- Publish button sends the composed single string to the Rebels contract via `publishPost(...)` once:
  - Wallet is connected and providers are ready.
  - A 64‑hex secret key is loaded in Profile (used to set private state and sign/prove).
- Success/failure toasts include TX hash when available; flow status reflects proving/signing/submission.

### Story (/story/:id)

- Loads the full content of a single story by post ID and renders it with the same parsing rules as the feed.
- Shows author and +/− counts; includes a back link to headlines.

### Profile (/profile)

- Enter a 64‑character hex secret key. It’s kept only in memory (not persisted).
- Loads user info via `getUserInfoFromSecretKey(...)` and stores it in the Auth context for use across pages.
- Displays alias (if set in contract) and current reputation. Once loaded, you can publish and vote from other routes.

### Debug (/debug)

### Midnight Drop (/drop)

- Freedom Vault: a focused feed for important documents that should be accessible to all. It filters the same on-chain posts to those tagged with `drop` (or `drops`).
- Each card shows the title, summary, image (if any), and extracts the first URL in the content to provide a primary "Open Document" action and a secondary "Mirror/Archive" action.
- To publish a drop, add a tags line in the Create page: `tags: drop, politics` and include the target URL (HTTP(s) or ipfs://) anywhere in the content.

- Utilities for development, including selecting a custom proof server. Keep sensitive data out of logs.

## Contract integration details

- Reads:
  - getAllPosts(publicDataProvider, contractAddress) → PostWithMetadata[]
  - getUserInfo(publicDataProvider, contractAddress, publicKey[, postId]) → alias, reputation, and vote status.
  - checkUserVote(...) → "plus" | "minus" | null (per post).
  - getReferralCount(...) → remaining referrals (0‑2).
- Writes (require wallet + secret key in memory):
  - publishPost(providers, contractAddress, content, secretKeyHex)
  - votePlus/voteMinus(providers, contractAddress, postId, secretKeyHex)
  - flagPost(providers, contractAddress, postId, secretKeyHex)
  - suggestNewUser(providers, contractAddress, newUserPublicKeyHex, secretKeyHex)
- Key utilities:
  - derivePublicKeyFromSecret(secretKeyHex) — builds Bytes<32> and runs the contract’s pure circuit.
  - coinPublicKeyToHex(coinPublicKey) — normalizes wallet key formats to 64‑hex.

## Post content format (single string)

To remain compatible with the contract’s single‑string payload, stories are composed as:

- Title: `# My headline`
- Image (optional): `![image](https://...)`
- Summary (optional): `> One line summary`
- Tags (optional): `tags: drop, politics` (comma or space separated)
- Body: free text paragraphs

The feed shows a teaser (title, image, summary). The Story page renders the full body.

## UX notes and safeguards

- Buttons for vote/flag/publish disable automatically if providers aren’t ready or the secret key isn’t loaded.
- Voting buttons reflect current user’s vote state per post and prevent multiple votes client‑side; contract enforces it on chain.
- Referral flow guards input length/format and remaining quota.
- Secret key length/hex validation runs before attempting profile load or writes.

## Theming & assets

- ThemeProvider offers light/dark via a mode toggle.
- Toasts (Sonner) are enabled globally, top‑right, with rich colors.
- Favicon uses project logos: `transparent-logo-black.svg` (light) and `transparent-logo-white.svg` (dark).

## Troubleshooting

- “Connect wallet to publish posts and vote”: connect a Midnight Lace wallet in the browser and refresh.
- “Secret key required”: go to Profile and load a valid 64‑hex key before publishing/voting.
- Custom proof server: open Debug and toggle the custom prover if the wallet’s prover is unavailable.
- Empty feed: ensure the configured contract address is correct and reachable on TestNet.

## Tech stack

- Vite 6, React 19, TypeScript 5
- Midnight Mesh SDK (providers, wallet, network)
- Tailwind‑based UI with shadcn‑like components
- Pino logging, Sonner toasts

---

For implementation references, see:
- App composition: `src/App.tsx`
- Contract bindings and helpers: `src/lib/rebels.ts`
- Pages: `src/pages/rebels`, `src/pages/create`, `src/pages/story`, `src/pages/profile`, `src/pages/wallet-ui`
