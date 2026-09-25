# Crystonia Portal

A real Node/Express web service backed by Supabase—not a static site. It includes citizen accounts, balances and atomic crystalline transfers, marketplace purchases, private crystal mail, and a shared town chat.

## How the portal is arranged

The front page is what every visitor sees first: the welcome, the national facts, our neighbours, and how to support us. Nothing else is on it.

Each feature then lives in its own tab — **Bank**, **Market**, **Mail** and **Commons**. These tabs are for citizens only. Until someone signs in they stay locked and hidden, and choosing one opens the sign-in window instead. Once a citizen signs in the tabs unlock, and a **Leave** button appears so they can sign out again on a shared classroom computer.

## Set it up

1. Create a Supabase project. In **Authentication → Providers**, ensure Email is enabled (for a classroom prototype you may disable email confirmation).
2. In the Supabase SQL Editor, run [`schema.sql`](schema.sql).
3. Copy `config.example.js` to `config.js`, then insert the project URL and **anon** key. This is the public browser key, not your service-role key.
4. Copy `.env.example` to `.env` and provide the same URL and anon key for the API server.
5. Run `npm install && npm run dev`, then visit `http://localhost:3000`.

## The CyvaPay support link

Crystonia asks for community support through CyvaPay. Paste the full link into `config.js`:

```js
window.CRYSTONIA_CYVAPAY_URL = 'https://...';
```

That one value fills in every support button — the one in the header, the one on the front page, and the one in the footer. While it is left empty the buttons explain that the link is still being set up, so the page never shows a broken link.

## Deploy to Render

Push this folder to GitHub, then create a Render Blueprint from the repository. [`render.yaml`](render.yaml) creates the Node web service. In Render, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project. Commit your filled-in `config.js` as well (the anon key is designed to be public; database RLS protects data).

The SQL migration uses row-level security and database functions for money-changing actions, so clients cannot edit balances directly.
