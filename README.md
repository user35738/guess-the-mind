# Who’s on Your Mind?

A two-or-more player guessing game with live chat. One player secretly picks a person,
the others ask questions and guess.

## Set up online play (free, about 5 minutes)

1. Create a free project at https://supabase.com.
2. Open **Project Settings > API** and copy the **Project URL** and the **anon / publishable key**.
3. Paste both into `config.js`.
4. Deploy the folder to Vercel (drag the folder into vercel.com/new, or run `vercel` inside it).

No database tables are needed. The game uses Supabase Realtime Broadcast only.

Everyone who opens your Vercel link and enters the same room code plays together.
# guess-the-mind
