# AURA — self-hosted (Vercel + Supabase)

Hosted AURA with **accounts**, **saved progress**, and an **iOS Liquid-Glass** UI.
The Gemini key never touches the browser — it lives in a Vercel env var and is used
only by a serverless function (`/api/gemini`) that also verifies the caller is signed in.

```
aura-app/
├── index.html         ← the app (Liquid-Glass UI; Supabase URL + anon key already filled in)
├── api/gemini.js      ← serverless proxy; reads GEMINI_API_KEY (server only)
├── supabase/schema.sql
├── package.json
└── README.md
```

---

## Already done for you (Supabase)

I provisioned the database via the connector, so this part is complete:

- **Project:** `aura`  (region **us-east-1**)
- **Project URL:** `https://qivlkxzohiorzvnfqiuh.supabase.co`
- **Schema applied:** `user_plans` table + Row-Level Security (each user can only
  read/write their own row).
- **`index.html` is wired** with the project URL and public anon key already.

> One Supabase setting I couldn't change via the connector: **email confirmation**.
> It's **ON by default**, so new sign-ups must click a confirmation email before their
> first login. To allow instant login during testing, turn it off in the dashboard:
> **Authentication -> Providers -> Email -> uncheck "Confirm email"**.

## Two steps left (Vercel) — needs your account

The Vercel connector can't push local files or set env vars, so these run from your side.

### 1. Deploy

**Git (one click):** push this folder to a GitHub repo -> in Vercel **Add New -> Project**
-> import it -> **Deploy**. No framework preset (it's static + serverless functions).

**or CLI:** `npm i -g vercel`, then from inside `aura-app/` run `vercel` and follow prompts.

### 2. Set environment variables, then redeploy

Vercel -> your project -> **Settings -> Environment Variables** (add for **Production**):

| Name                | Value                                                          |
|---------------------|----------------------------------------------------------------|
| `GEMINI_API_KEY`    | **your** key from aistudio.google.com  (secret — only you have it) |
| `SUPABASE_URL`      | `https://qivlkxzohiorzvnfqiuh.supabase.co`                     |
| `SUPABASE_ANON_KEY` | (the long anon JWT — same one already in index.html)           |

Then trigger a redeploy so the function picks up the variables.

That's it — open the Vercel URL, create an account, build a plan. Auth, progress
sync, and the engine work immediately; **AI features (Build my plan / coach) start
working once `GEMINI_API_KEY` is set.**

---

### Notes
- **Quick plan** (the deterministic engine) and **progress saving** work without any
  Gemini key. Only the AI personalization + coach chat need it.
- **Costs:** the Supabase project is on the **$0 free tier**; Vercel's free tier covers
  a personal app. Gemini billing is on your Google key.
- **Local dev:** `vercel dev` from inside `aura-app/` runs the static site + `/api`
  function together (put the three env vars in a local `.env`). Opening `index.html`
  directly as a file won't run AI features (no `/api` server).
- **Anon key is public by design** — your data is protected by the row-level security
  policies, not by hiding this key.
