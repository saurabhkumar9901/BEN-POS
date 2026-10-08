import { AwsClient } from "aws4fetch";

function r2() {
  const account = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!account || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3" }),
    base: `https://${account}.r2.cloudflarestorage.com/${bucket}`,
    bucket,
  };
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w.\-() ]/g, "_").trim() || "upload.txt";
}

/** Mint presigned PUT URLs for direct browser -> R2 uploads. */
export async function POST(request: Request) {
  const cfg = r2();
  if (!cfg) {
    return Response.json({ error: "R2 not configured (R2_* env)" }, { status: 500 });
  }
  const body = (await request.json().catch(() => ({}))) as { files?: string[] };
  const files = (body.files ?? []).filter((f) => typeof f === "string").slice(0, 32);
  if (!files.length) {
    return Response.json({ error: "files[] required" }, { status: 400 });
  }
  const batch = Date.now().toString(36);
  const uploads = await Promise.all(
    files.map(async (name) => {
      const key = `uploads/${batch}/${safeName(name)}`;
      const signed = await cfg.client.sign(`${cfg.base}/${key}`, {
        method: "PUT",
        aws: { signQuery: true },
      });
      return { name: safeName(name), key, url: signed.url };
    })
  );
  return Response.json({ uploads });
}
