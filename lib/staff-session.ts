// Client helper · resolve staff session tenant for internal pages

export type StaffSession = {
  accountId: string;
  tenant: string;
  role: string;
  name: string | null;
  email: string | null;
  initials: string | null;
  tenantName: string;
};

export async function fetchStaffSession(): Promise<StaffSession | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as StaffSession;
    if (!json.tenant) return null;
    return json;
  } catch {
    return null;
  }
}
