const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

export function month(iso?: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

export function longDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function usd(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}B`;
  if (m >= 10) return `$${Math.round(m)}M`;
  return `$${m.toFixed(1)}M`;
}

export function domain(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function nextMonday(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const add = ((8 - d.getUTCDay()) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABEL: Record<string, string> = {
  tracking: "Tracking",
  leader: "Category leader",
  written_up: "Written up",
  exited: "Exited",
  shut_down: "Shut down",
};

export const FALLBACK_COLORS = ["#2F6B5B", "#8A4B2A", "#3D4F8F", "#7A5C8E", "#5C6B2F", "#2F5F7A", "#8E5C6E", "#6B6B3A"];

export function sectorColor(sectors: { id: string; color?: string | null }[], id: string): string {
  const i = sectors.findIndex((s) => s.id === id);
  return sectors[i]?.color || FALLBACK_COLORS[(i < 0 ? 0 : i) % FALLBACK_COLORS.length];
}
