import { getObservatory } from "@/lib/data";

export const revalidate = 3600;

/** The published data, for the desks and anyone else who wants the numbers behind the map. */
export async function GET() {
  const { data, live } = await getObservatory();
  return Response.json(
    { ...data, source: live ? "live" : "snapshot" },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
