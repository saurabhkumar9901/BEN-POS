import { createClient } from "@supabase/supabase-js";

function cfg() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? "benpos-drops";
  if (!url || !serviceKey) return null;
  return { url, serviceKey, bucket };
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w.\-() ]/g, "_").trim() || "upload.txt";
}

/** Mint Supabase signed PUT URLs for direct browser -> bucket uploads. */
export async function POST(request: Request) {
  const c = cfg();
  if (!c) {
    return Response.json(
      { error: "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }
  const body = (await request.json().catch(() => ({}))) as { files?: string[] };
  const files = (body.files ?? []).filter((f) => typeof f === "string").slice(0, 32);
  if (!files.length) {
    return Response.json({ error: "files[] required" }, { status: 400 });
  }
  const supabase = createClient(c.url, c.serviceKey);
  const batch = Date.now().toString(36);
  const uploads = [];
  for (const name of files) {
    const clean = safeName(name);
    const key = `uploads/${batch}/${clean}`;
    const { data, error } = await supabase.storage
      .from(c.bucket)
      .createSignedUploadUrl(key, { upsert: true });
    if (error || !data?.signedUrl) {
      return Response.json(
        { error: `presign failed for ${clean}: ${error?.message ?? "unknown"}` },
        { status: 500 }
      );
    }
    uploads.push({ name: clean, key, url: data.signedUrl });
  }
  return Response.json({ uploads });
}
