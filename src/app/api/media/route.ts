import { requireAdmin, apiError } from "@/lib/auth";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "";
    if (
      !/^[\da-f-]{36}\/(inputs|runs)\/[\da-f-]{36}(\/[\da-f-]{36}-\d+)?\.(png|jpg|jpeg|webp)$/.test(
        path,
      )
    )
      return new Response("Not found", { status: 404 });
    const { data, error } = await supabase.storage
      .from("prompt-chain-media")
      .download(path);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="chain-output.${path.split(".").pop()}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
