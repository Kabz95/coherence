# Codespaces quickstart

1. Open this repository in GitHub Codespaces (the `.devcontainer` targets `coherence/web`).
2. Wait for `postCreateCommand` to finish (`npm install` inside `coherence/web`).
3. Copy Firebase web config if you have it:

   ```bash
   cp coherence/web/.env.local.example coherence/web/.env.local
   # then fill in the NEXT_PUBLIC_FIREBASE_* values
   ```

   Without Firebase values the app runs in **demo mode** with seeded symposium
   cases, so the demo click path works with zero configuration.

4. Start the dev server:

   ```bash
   cd coherence/web && npm run dev
   ```

5. Open the forwarded port **3000** and follow `coherence/web/DEMO.md`.
