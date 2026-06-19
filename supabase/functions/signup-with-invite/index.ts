// signup-with-invite  (deployed to Supabase Edge Functions, verify_jwt = false)
// Invite-only account creation. A new user has no JWT yet, so this endpoint is
// unauthenticated by design — access is gated by requiring a valid, unused
// invite code, which is validated and consumed atomically with the service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: { email?: string; password?: string; code?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const code = String(payload.code || "").trim().toUpperCase();

  if (!email || !password || !code) {
    return json({ error: "Email, password and invite code are all required." }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. invite code must exist and be unused
  const { data: codeRow, error: codeErr } = await admin
    .from("invite_codes")
    .select("code, used_by")
    .eq("code", code)
    .maybeSingle();
  if (codeErr) return json({ error: "Could not verify invite code." }, 500);
  if (!codeRow) return json({ error: "That invite code isn't valid." }, 403);
  if (codeRow.used_by) return json({ error: "That invite code has already been used." }, 403);

  // 2. create the user, email pre-confirmed so they can sign in immediately
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message || "Could not create account." }, 400);
  }

  // 3. consume the code; conditional update guards against a race
  const { data: claimed, error: claimErr } = await admin
    .from("invite_codes")
    .update({ used_by: created.user.id, used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_by", null)
    .select("code");
  if (claimErr || !claimed || claimed.length === 0) {
    // lost the race — roll back the just-created user
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "That invite code has already been used." }, 403);
  }

  return json({ ok: true });
});
