import Orrery from "@/components/Orrery";
import CompanyTable from "@/components/CompanyTable";
import { getObservatory } from "@/lib/data";
import { longDate } from "@/lib/format";
import HideFromQuery from "@/components/HideFromQuery";

export const revalidate = 3600;
export const metadata = { robots: { index: false, follow: false } };

/*
 * For the desks: the orrery and the list, no page chrome.
 * A host page hides a reader's own portfolio with ?hide=A,B or
 * window.postMessage({ type: "observatory:hide", names: [...] }, "*").
 */
export default async function Embed() {
  const { data } = await getObservatory();
  return (
    <main className="embed">
      <HideFromQuery />
      <div className="embed-head">
        <p className="embed-title">{data.thesis.name}</p>
        {data.edition && <p className="fine">Edition {data.edition.number}, {longDate(data.edition.date)}. Updated weekly.</p>}
      </div>
      <div className="embed-plate">
        <Orrery sectors={data.thesis.sectors} companies={data.companies} changes={data.changes} thesisName={data.thesis.name} compact />
      </div>
      <CompanyTable companies={data.companies} sectors={data.thesis.sectors} />
    </main>
  );
}
