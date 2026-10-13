export type Round = {
  round?: string; amount?: string; date?: string; leads?: string; valuation?: string; source?: string;
};
export type Exit = {
  type?: string; acquirer?: string; date?: string; value?: string; state?: string; source?: string;
};
export type Company = {
  id: number;
  name: string;
  website: string | null;
  sector: string;
  description: string;
  geo: string | null;
  founded: number | null;
  stage: string | null;
  raised: string | null;
  raisedUsdM: number | null;
  raisedBasis?: "total" | "latest_round" | "estimate";
  aliases?: string[];
  investors: string[];
  lastRound: Round | null;
  exit: Exit | null;
  status: "tracking" | "leader" | "written_up" | "exited" | "shut_down";
  writeUp: string | null;
  note: string;
  dateAdded: string | null;
  lastVerified: string | null;
  verifiedBy: string;
  confidence: string | null;
  sources: string[];
};
export type Sector = { id: string; name: string; short: string; description: string; color?: string | null };
export type Change = { company: string; sector: string; kind: string; headline: string; date: string; source?: string };
export type EditionSummary = {
  number: number; date: string; kind: string; checked: number; applied: number; held: number; headlines: string[];
};
export type Candidate = {
  date: string; name: string; tier: string; score: number; sector: string; oneLiner: string; website?: string | null;
};
export type ObservatoryData = {
  schema: number;
  generatedAt: string;
  thesis: {
    fund: string; name: string; coreBelief: string; updated: string; stage: string;
    geography: { primary?: string[]; secondary?: string[] };
    sectors: Sector[];
    lenses: string[];
  };
  edition: { number: number; date: string; kind: string; checked: number; applied: number; held: number; note?: string } | null;
  changes: Change[];
  editions: EditionSummary[];
  companies: Company[];
  candidates: Candidate[];
  heldForReview: number;
  method: { schedule: string; requireSourceMatch: boolean; excludedCount: number };
  audit?: { date: string; passed: number; checked: number; unreadable?: number; notStated?: number } | null;
};
