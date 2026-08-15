# Crazy Chess Battles ♞

Competitive online chess platform — play, battle, win, rank.

## Stack

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS
- **Database:** Supabase (PostgreSQL) + Auth
- **Hosting:** Vercel (free tier)
- **Chess UI:** react-chessboard (MIT)
- **Chess Logic:** chess.js (BSD-2-Clause)
- **Rating System:** glicko2js (MIT)

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com) (free tier)
2. Go to Settings > API to get your Project URL and anon key
3. Copy `.env.example` to `.env.local` and fill in the values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
4. Run the migration in Supabase SQL Editor:
   ```bash
   # Copy contents of supabase/migrations/001_initial_schema.sql
   # Paste into Supabase SQL Editor and run
   ```

### 3. Run dev server
```bash
npm run dev
```

### 4. Deploy to Vercel
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login & signup pages
│   ├── (app)/           # Authenticated app pages
│   │   ├── dashboard/   # Home with stats
│   │   ├── play/        # Quick match & game lobby
│   │   ├── game/[id]/   # Live game view
│   │   ├── tournaments/ # Tournament list & details
│   │   ├── leaderboard/ # Global rankings
│   │   └── profile/[username]/ # Player profiles
│   └── page.tsx         # Landing page
├── components/
│   ├── game/            # Chessboard & game UI
│   └── layout/          # Nav & app shell
└── lib/
    ├── supabase/        # Client & server clients
    └── utils.ts         # Helpers
supabase/
└── migrations/
    └── 001_initial_schema.sql  # Full database schema
```

## Roadmap

- **Phase 1 (MVP):** Auth, profiles, game UI, leaderboard, tournaments
- **Phase 2:** Real-time game server (WebSocket), matchmaking, live play
- **Phase 3:** Anti-cheat engine, admin dashboard, paid tournaments

## License

Proprietary. All open-source components used under their permissive licenses (MIT, BSD-2-Clause).
