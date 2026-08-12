import { notFound } from "next/navigation";
import { ShopClient } from "@/components/ShopClient";
import { getTenant } from "@/lib/tenants";

export default async function TenantShopPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const t = getTenant(tenant);
  if (!t) notFound();

  return (
    <ShopClient
      channel="consumer"
      tenant={t.slug}
      brandName={t.brand.name}
      homeHref={`/t/${t.slug}`}
      accentStyle="brand"
    />
  );
}
