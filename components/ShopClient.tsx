"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PaymentStep } from "@/components/PaymentStep";
import {
  PRODUCT_CATEGORY_LABEL,
  formatKr,
  listProducts,
  unitPrice,
  type ProductCategory,
  type ShopChannel,
  type ShopProduct,
} from "@/lib/shop-products";

type CartLine = { product: ShopProduct; qty: number };
type Step = "browse" | "cart" | "pay" | "done";

type Props = {
  channel: ShopChannel;
  /** For consumer: tenant slug. For b2b: payment tenant key. */
  tenant: string;
  brandName: string;
  homeHref: string;
  accentStyle?: "brand" | "ink";
};

export function ShopClient({ channel, tenant, brandName, homeHref, accentStyle = "brand" }: Props) {
  const all = useMemo(() => listProducts({ channel, tenant: channel === "consumer" ? tenant : undefined }), [channel, tenant]);
  const categories = useMemo(() => {
    const set = new Set(all.map((p) => p.category));
    return Array.from(set);
  }, [all]);

  const [category, setCategory] = useState<ProductCategory | "alle">("alle");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [step, setStep] = useState<Step>("browse");
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "", clinic: "" });
  const [orderId, setOrderId] = useState<string | null>(null);

  const filtered = category === "alle" ? all : all.filter((p) => p.category === category);
  const totalKr = cart.reduce((s, l) => s + unitPrice(l.product, channel) * l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  const ink = accentStyle === "brand" ? "var(--brand-ink)" : "var(--color-ink)";
  const paper = accentStyle === "brand" ? "var(--brand-paper)" : "var(--color-paper)";

  const add = (product: ShopProduct) => {
    const min = channel === "b2b" ? product.b2bMinQty ?? 1 : 1;
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, { product, qty: min }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== id) return l;
          const min = channel === "b2b" ? l.product.b2bMinQty ?? 1 : 1;
          return { ...l, qty: Math.max(min, qty) };
        })
        .filter((l) => l.qty > 0),
    );
  };

  const remove = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  const orderLabel =
    cart.length === 1
      ? `${cart[0].product.name}${cart[0].qty > 1 ? ` ×${cart[0].qty}` : ""}`
      : `${cartCount} varer · ${brandName} shop`;

  if (step === "done" && orderId) {
    return (
      <div className="mx-auto max-w-[560px] text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[22px]"
          style={{ background: ink, color: paper }}
        >
          ✓
        </div>
        <h1 className="display mt-5 text-[32px] font-semibold">Tak for din ordre</h1>
        <p className="mt-3 text-[14px] text-muted">
          Ordre <span className="mono">{orderId}</span> er registreret.
          {channel === "b2b"
            ? " Vi sender ordrebekræftelse og leveringsinfo på e-mail."
            : " Du kan hente varerne i klinikken — eller få dem med efter næste behandling."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCart([]);
              setOrderId(null);
              setStep("browse");
            }}
            className="rounded-[12px] px-5 py-3 text-[14px] font-medium"
            style={{ background: ink, color: paper }}
          >
            Fortsæt shopping
          </button>
          <Link href={homeHref} className="rounded-[12px] border border-line px-5 py-3 text-[14px]">
            Tilbage
          </Link>
        </div>
      </div>
    );
  }

  if (step === "pay") {
    return (
      <div className="mx-auto max-w-[560px]">
        <button type="button" onClick={() => setStep("cart")} className="text-[13px] text-muted hover:text-ink">
          ← Kurv
        </button>
        <h1 className="display mt-4 text-[28px] font-semibold">Betaling</h1>
        <p className="mt-1 text-[13px] text-muted">{orderLabel} · {formatKr(totalKr)}</p>
        <div className="mt-6">
          <PaymentStep
            tenant={tenant}
            serviceName={orderLabel}
            amountKr={totalKr}
            paymentMode="prepay"
            chargeLabel="Trækkes ved køb"
            onBack={() => setStep("cart")}
            onPaid={() => {
              const id = `ORD-${Date.now().toString(36).toUpperCase()}`;
              setOrderId(id);
              setStep("done");
            }}
          />
        </div>
      </div>
    );
  }

  if (step === "cart") {
    return (
      <div className="mx-auto max-w-[640px]">
        <button type="button" onClick={() => setStep("browse")} className="text-[13px] text-muted hover:text-ink">
          ← Fortsæt med at handle
        </button>
        <h1 className="display mt-4 text-[32px] font-semibold">Kurv</h1>

        {cart.length === 0 ? (
          <p className="mt-6 text-[14px] text-muted">Kurven er tom.</p>
        ) : (
          <>
            <ul className="mt-6 space-y-3">
              {cart.map((l) => {
                const price = unitPrice(l.product, channel);
                return (
                  <li
                    key={l.product.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-card p-4"
                  >
                    <div className="min-w-0">
                      <div className="display text-[16px] font-semibold">{l.product.name}</div>
                      <div className="text-[12px] text-muted">
                        {formatKr(price)} · {l.product.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={channel === "b2b" ? l.product.b2bMinQty ?? 1 : 1}
                        value={l.qty}
                        onChange={(e) => setQty(l.product.id, Number(e.target.value) || 1)}
                        className="w-16 rounded-[8px] border border-line bg-paper px-2 py-1.5 text-[13px]"
                      />
                      <div className="w-20 text-right text-[14px] font-medium">{formatKr(price * l.qty)}</div>
                      <button
                        type="button"
                        onClick={() => remove(l.product.id)}
                        className="text-[12px] text-muted hover:text-ink"
                      >
                        Fjern
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 space-y-3 rounded-[14px] border border-line bg-card p-5">
              <div className="kicker">{channel === "b2b" ? "Klinik / levering" : "Dine oplysninger"}</div>
              {channel === "b2b" && (
                <input
                  placeholder="Kliniknavn"
                  value={buyer.clinic}
                  onChange={(e) => setBuyer({ ...buyer, clinic: e.target.value })}
                  className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px]"
                />
              )}
              <input
                placeholder="Navn"
                value={buyer.name}
                onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px]"
              />
              <input
                placeholder="E-mail"
                type="email"
                value={buyer.email}
                onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px]"
              />
              <input
                placeholder="Telefon"
                value={buyer.phone}
                onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
                className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px]"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="display text-[22px] font-semibold">I alt {formatKr(totalKr)}</div>
              <button
                type="button"
                disabled={!buyer.name || !buyer.email || (channel === "b2b" && !buyer.clinic)}
                onClick={() => setStep("pay")}
                className="rounded-[12px] px-5 py-3 text-[14px] font-medium disabled:opacity-40"
                style={{ background: ink, color: paper }}
              >
                Gå til betaling
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">{channel === "b2b" ? "B2B · engros" : "Webshop"}</div>
          <h1 className="display mt-2 text-[36px] font-semibold md:text-[42px]">
            {channel === "b2b" ? "Creme, udstyr & forbrug til klinikken" : "Plejeprodukter & udstyr"}
          </h1>
          <p className="mt-3 max-w-[520px] text-[14px] text-muted">
            {channel === "b2b"
              ? "Køb ind til din fodplejeklinik — engrospriser, klar til videresalg eller klinikbrug."
              : `Anbefalet af ${brandName}. Hent i klinikken eller tag med efter din næste tid.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("cart")}
          className="rounded-[12px] px-4 py-2.5 text-[13px] font-medium"
          style={{ background: ink, color: paper }}
        >
          Kurv{cartCount > 0 ? ` · ${cartCount}` : ""}
        </button>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <CatBtn active={category === "alle"} onClick={() => setCategory("alle")} ink={ink} paper={paper}>
          Alle
        </CatBtn>
        {categories.map((c) => (
          <CatBtn key={c} active={category === c} onClick={() => setCategory(c)} ink={ink} paper={paper}>
            {PRODUCT_CATEGORY_LABEL[c]}
          </CatBtn>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const price = unitPrice(p, channel);
          return (
            <article
              key={p.id}
              className="flex flex-col rounded-[14px] border border-line bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="kicker !text-[9.5px]">{PRODUCT_CATEGORY_LABEL[p.category]}</span>
                {p.highlighted && (
                  <span className="rounded-[6px] px-2 py-0.5 text-[10px] font-medium" style={{ background: ink, color: paper }}>
                    Anbefalet
                  </span>
                )}
              </div>
              <h2 className="display mt-3 text-[20px] font-semibold leading-snug">{p.name}</h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{p.summary}</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="display text-[22px] font-semibold">{formatKr(price)}</span>
                <span className="text-[12px] text-faint">/ {p.unit}</span>
              </div>
              {channel === "b2b" && p.priceKr !== price && (
                <div className="mt-1 text-[11px] text-muted">
                  Vejl. udsalg {formatKr(Math.round(price * 1.35))} · min. {p.b2bMinQty ?? 1} {p.unit}
                </div>
              )}
              <button
                type="button"
                onClick={() => add(p)}
                className="mt-4 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] font-medium hover:border-ink/40"
              >
                Læg i kurv
              </button>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-[14px] text-muted">Ingen varer i denne kategori endnu.</p>
      )}
    </div>
  );
}

function CatBtn({
  active,
  onClick,
  children,
  ink,
  paper,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ink: string;
  paper: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[10px] border px-3.5 py-2 text-[12.5px]"
      style={{
        borderColor: active ? ink : "var(--color-line-2)",
        background: active ? ink : "var(--color-card)",
        color: active ? paper : "inherit",
      }}
    >
      {children}
    </button>
  );
}
