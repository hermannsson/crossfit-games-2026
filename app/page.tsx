import { loadSnapshot } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

// Read the snapshot fresh on each request so `npm run fetch` updates show up
// without a rebuild.
export const dynamic = "force-dynamic";

export default async function Page() {
  const snapshot = await loadSnapshot();
  return <Dashboard snapshot={snapshot} />;
}
