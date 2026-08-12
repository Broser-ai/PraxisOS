import Link from "next/link";
import {
  PRODUCT_CATEGORY_LABEL,
  SHOP_PRODUCTS,
  formatKr,
} from "@/lib/shop-products";

export default function AdminProductsPage() {
  const consumer = SHOP_PRODUCTS.filter((p) => p.channels.includes("consumer"));
  const b2b = SHOP_PRODUCTS.filter((p) => p.channels.includes("b2b"));

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="kicker">Drift · webshop</div>
      <h1 className="display mt-2 text-[32px] font-semibold">Produkter</h1>
      <p className="mt-2 max-w-[560px] text-[14px] text-muted">
        Startkatalog til forbruger-shop (tenant) og B2B-engros. Priser redigeres her når lager kobles på DB.
      </p>

      <section className="mt-10">
        <h2 className="display text-[20px] font-semibold">Forbruger · tenant-shops</h2>
        <p className="mt-1 text-[13px] text-muted">
          Live hos{" "}
          <Link href="/t/bypilar/shop" className="underline underline-offset-2">
            /t/bypilar/shop
          </Link>
        </p>
        <ProductTable rows={consumer} showTenant />
      </section>

      <section className="mt-12">
        <h2 className="display text-[20px] font-semibold">B2B · engros</h2>
        <p className="mt-1 text-[13px] text-muted">
          Live på{" "}
          <Link href="/shop" className="underline underline-offset-2">
            /shop
          </Link>
        </p>
        <ProductTable rows={b2b} showB2b />
      </section>
    </div>
  );
}

function ProductTable({
  rows,
  showTenant,
  showB2b,
}: {
  rows: typeof SHOP_PRODUCTS;
  showTenant?: boolean;
  showB2b?: boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-[14px] border border-line">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-line bg-paper-2/60 text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Produkt</th>
            <th className="px-4 py-3 font-medium">Kategori</th>
            {showTenant && <th className="px-4 py-3 font-medium">Tenant</th>}
            <th className="px-4 py-3 font-medium">Pris</th>
            {showB2b && <th className="px-4 py-3 font-medium">B2B</th>}
            <th className="px-4 py-3 font-medium">Lager</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-4 py-3">
                <div className="font-medium">{p.name}</div>
                <div className="mono text-[11px] text-faint">{p.id}</div>
              </td>
              <td className="px-4 py-3 text-muted">{PRODUCT_CATEGORY_LABEL[p.category]}</td>
              {showTenant && <td className="px-4 py-3 mono text-[12px]">{p.tenant}</td>}
              <td className="px-4 py-3">{formatKr(p.priceKr)}</td>
              {showB2b && (
                <td className="px-4 py-3">{p.b2bPriceKr != null ? formatKr(p.b2bPriceKr) : "—"}</td>
              )}
              <td className="px-4 py-3">{p.stock}</td>
              <td className="px-4 py-3">
                <span className={p.active ? "text-signal" : "text-muted"}>
                  {p.active ? "Aktiv" : "Skjult"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
