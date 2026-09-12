# Crystonia Portal

A real Node/Express web service backed by Supabase—not a static site. It includes citizen accounts, balances and atomic crystalline transfers, marketplace purchases, private crystal mail, and a shared town chat.

## Set it up

1. Create a Supabase project. In **Authentication → Providers**, ensure Email is enabled (for a classroom prototype you may disable email confirmation).
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `public/config.example.js` to `public/config.js`, then insert the project URL and **anon** key. This is the public browser key, not your service-role key.
4. Copy `.env.example` to `.env` and provide the same URL and anon key for the API server.
5. Run `npm install && npm run dev`, then visit `http://localhost:3000`.

## Deploy to Render

Push this folder to GitHub, then create a Render Blueprint from the repository. [`render.yaml`](render.yaml) creates the Node web service. In Render, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project. Commit your filled-in `public/config.js` as well (the anon key is designed to be public; database RLS protects data).

The SQL migration uses row-level security and database functions for money-changing actions, so clients cannot edit balances directly.
