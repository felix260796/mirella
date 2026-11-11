// Mirella Push: schickt eine Mitteilung an alle registrierten iPhones (Apple Push, APNs).
// Aufruf nur mit dem geheimen Wert x-push-secret (setzt der GitHub-Workflow automatisch).
import { createClient } from "jsr:@supabase/supabase-js@2";

const TEAM = Deno.env.get("APPLE_TEAM_ID")!;
const KID = Deno.env.get("APNS_KEY_ID")!;
const P8 = Deno.env.get("APNS_KEY_P8")!;
const SECRET = Deno.env.get("PUSH_SECRET")!;
const TOPIC = "de.brenzinger.mirella";

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function apnsJwt(): Promise<string> {
  const pem = P8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: KID })));
  const body = b64url(enc.encode(JSON.stringify({ iss: TEAM, iat: Math.floor(Date.now() / 1000) })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  return head + "." + body + "." + b64url(sig);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== SECRET) return new Response("nein", { status: 401 });
  const { title, body, view } = await req.json();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: devices, error } = await db.from("mirella_device").select("token");
  if (error) return new Response(error.message, { status: 500 });
  const jwt = await apnsJwt();
  const out: Record<string, number> = {};
  for (const d of devices ?? []) {
    const r = await fetch("https://api.push.apple.com/3/device/" + d.token, {
      method: "POST",
      headers: { authorization: "bearer " + jwt, "apns-topic": TOPIC, "apns-push-type": "alert", "apns-priority": "10" },
      body: JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, view: view ?? "heute" }),
    });
    out[d.token.slice(0, 8)] = r.status;
    if (r.status === 410 || r.status === 400) await db.from("mirella_device").delete().eq("token", d.token);
  }
  return Response.json({ sent: out });
});
