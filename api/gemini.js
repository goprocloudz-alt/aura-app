// api/gemini.js
// Secure server-side proxy to Google Gemini.
// The Gemini API key lives ONLY here (a Vercel environment variable) and is
// never sent to the browser. Requests are gated to signed-in Supabase users
// so the key can't be abused by anyone who finds the endpoint.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_ANON = process.env.SUPABASE_ANON_KEY;

  if (!GEMINI_KEY) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
    return;
  }
  if (!SB_URL || !SB_ANON) {
    res.status(500).json({ error: 'Server is missing SUPABASE_URL / SUPABASE_ANON_KEY.' });
    return;
  }

  // ---- verify the caller is a signed-in user ----
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return;
  }
  try {
    const who = await fetch(SB_URL.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + token }
    });
    if (!who.ok) {
      res.status(401).json({ error: 'Session invalid — please sign in again.' });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: 'Could not verify session.' });
    return;
  }

  // ---- proxy to Gemini ----
  const body = req.body || {};
  const model = String(body.model || 'gemini-2.5-flash').replace(/[^a-z0-9.\-]/gi, '');
  const payload = { contents: Array.isArray(body.contents) ? body.contents : [] };
  if (body.system) payload.system_instruction = { parts: [{ text: String(body.system) }] };
  if (body.generationConfig && typeof body.generationConfig === 'object') {
    payload.generationConfig = body.generationConfig;
  }

  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(GEMINI_KEY);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: (data && data.error && data.error.message) || 'Gemini error' });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Upstream error contacting Gemini.' });
  }
};
