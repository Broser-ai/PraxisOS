import { headers } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { isBypilarHost, safeStaffNextPath } from "@/lib/bypilar-host";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const whiteLabel = isBypilarHost(host);
  const clinic = getTenant("bypilar");
  const clinicName = clinic?.brand.name ?? "by Pilar";
  const nextPath = safeStaffNextPath(
    sp.next,
    whiteLabel ? "/dashboard" : "/review",
  );

  return (
    <LoginForm
      whiteLabel={whiteLabel}
      clinicName={clinicName}
      nextPath={nextPath}
    />
  );
}
