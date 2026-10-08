import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, listDataFiles, safeName } from "@/lib/jobs";

export async function GET() {
  return Response.json(listDataFiles());
}

export async function POST(request: Request) {
  const form = await request.formData();
  const kind = form.get("kind") === "ca" ? "ca" : "benpos";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return Response.json({ error: "no files uploaded" }, { status: 400 });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const saved: { name: string; mb: number }[] = [];
  for (const file of files) {
    const name = safeName(file.name);
    if (kind === "benpos" && !name.toLowerCase().endsWith(".txt")) continue;
    if (kind === "ca" && !name.toLowerCase().endsWith(".csv")) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(DATA_DIR, name), buf);
    saved.push({ name, mb: Math.round((buf.length / 1048576) * 10) / 10 });
  }
  return Response.json({ saved, files: listDataFiles() });
}
