# Who’s on Your Mind?

An online guessing game for two or more players. One player secretly thinks of a person,
and everyone else asks questions in a live chat and tries to work out who it is.

**Play it:** https://guess-the-mind.vercel.app/

## How to play

1. Everyone opens the game, enters a nickname and the same room code.
2. One player becomes the thinker. They type a secret person and an optional hint, such as
   "a footballer", then press **Start round**.
3. The other players ask questions in the chat. The thinker replies with the quick buttons:
   Yes, No, Sort of, Not sure or Don’t know.
4. When a player thinks they know the answer, they type a name and press **Guess**.
5. The thinker’s browser checks the guess. When someone gets it right, the secret is
   revealed to everyone, and anyone can start the next round.

Tips:

- Write other accepted spellings with a slash, for example `Messi / Lionel Messi`.
- The thinker can press **Give up and reveal** to end a round early.
- The secret never leaves the thinker’s browser until the round ends.

## Features

- Live chat and guessing between players on different devices
- Rooms created by sharing a simple code, with no account needed
- Accent and punctuation insensitive guess checking
- Light and dark mode that follows your device
- No build step: plain HTML, CSS and JavaScript

## Project structure

| File         | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `index.html` | Page shell and script loading                        |
| `style.css`  | All styling, including light and dark themes         |
| `script.js`  | Game rules, chat and the Supabase connection         |
| `config.js`  | Your Supabase project URL and publishable key        |

## Set up your own copy

1. Create a free project at https://supabase.com.
2. Open **Project Settings > API Keys** and copy the **Project URL** and the
   **publishable key** (it starts with `sb_publishable_`).
3. Paste them into `config.js`:

   ```js
   window.GAME_CONFIG = {
   	supabaseUrl: "https://YOUR-PROJECT.supabase.co",
   	supabaseAnonKey: "sb_publishable_...",
   };
   ```

4. Push the project to GitHub and import the repository in Vercel, or drag the folder
   into https://vercel.com/new.

No database tables are needed. The game only uses Supabase Realtime Broadcast to pass
messages between players.

> Never put the Supabase **secret key** in this project. Only the publishable key
> belongs in `config.js`.

## Run it locally

Open the folder in any static server, for example:

```bash
npx serve .
```

Then visit the address it prints, and open it in two browser windows to test a room.

## Known limits

- Players are not authenticated. Anyone who knows a room code can join, so use a
  hard-to-guess code for private games.
- Chat is not saved. Reloading the page clears the history.
- If the thinker closes their tab, the round stops, because their browser checks the
  guesses.

## Built with

- HTML, CSS and vanilla JavaScript
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) for live messaging
- [Vercel](https://vercel.com) for hosting