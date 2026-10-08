import { shareholderProfile } from "@/lib/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!/^ik_[0-9a-f]{16}$/.test(key)) {
    return Response.json({ error: "invalid investor key" }, { status: 400 });
  }
  const profile = await shareholderProfile(key);
  if (!profile.identity) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(profile);
}
