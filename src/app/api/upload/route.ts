import { requireAdmin, apiError } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { supabase, user } = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 3 * 1024 * 1024 || !file.size)
      return Response.json(
        { error: "Choose an image smaller than 3 MB." },
        { status: 400 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp)
      return Response.json(
        { error: "Use a PNG, JPEG, or WebP image." },
        { status: 400 },
      );
    const ext = png ? "png" : jpeg ? "jpg" : "webp";
    const path = `${user.id}/inputs/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("prompt-chain-media")
      .upload(path, bytes, { contentType: `image/${jpeg ? "jpeg" : ext}` });
    if (error) throw error;
    return Response.json({ path });
  } catch (error) {
    return apiError(error);
  }
}
