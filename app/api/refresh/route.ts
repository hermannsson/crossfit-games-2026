import { revalidateTag, revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

// Busts the data cache so the next request re-fetches live from the CrossFit
// APIs. Hit by the Vercel cron (which sends `Authorization: Bearer $CRON_SECRET`
// when CRON_SECRET is set) or manually. If CRON_SECRET is unset the endpoint is
// open (harmless — it only triggers a refresh).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  revalidateTag("cf-data");
  revalidatePath("/");

  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
