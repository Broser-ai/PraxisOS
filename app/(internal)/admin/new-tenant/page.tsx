"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPlanPrice, PLANS } from "@/lib/plans";

export default function NewTenantWizard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({
    legalName: "",
    cvr: "",
    address: "",
    phone: "",
    email: "",
    contactName: "",
    slug: "",
    plan: "practice",
  });

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...data,
          slug: data.slug || slugify(data.legalName),
          contactName: data.contactName || data.legalName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "fejl");
        return;
      }
      router.push(json.next?.setupUrl ?? `/t/${json.tenant.slug}/setup`);
    } catch {
      setError("netværksfejl");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link href="/admin/tenants" className="kicker hover:underline">
        ← Tenants
      </Link>
      <h1 className="display mt-2 text-[30px] font-semibold">Ny B2B-tenant</h1>
      <p className="mt-2 text-[13.5px] text-muted">
        Opretter rigtig tenant via /api/signup (samme flow som offentlig signup).
      </p>

      <div className="card mt-6 space-y-3 p-6">
        {(
          [
            ["legalName", "Kliniknavn"],
            ["cvr", "CVR"],
            ["address", "Adresse"],
            ["contactName", "Kontaktperson"],
            ["email", "E-mail"],
            ["phone", "Telefon"],
            ["slug", "Slug (valgfri)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="kicker">{label}</span>
            <input
              value={data[key]}
              onChange={(e) =>
                setData({
                  ...data,
                  [key]: key === "slug" ? slugify(e.target.value) : e.target.value,
                })
              }
              className="mt-1 w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px]"
            />
          </label>
        ))}

        <div className="pt-2">
          <div className="kicker mb-2">Licens</div>
          <div className="flex flex-col gap-2">
            {PLANS.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-[10px] border p-3 ${
                  data.plan === p.id ? "border-ink" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  checked={data.plan === p.id}
                  onChange={() => setData({ ...data, plan: p.id })}
                />
                <div>
                  <div className="font-medium">
                    {p.name} · {formatPlanPrice(p)}/md
                  </div>
                  <div className="text-[12px] text-muted">{p.tagline}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-[13px] text-clay">{error}</p>}

        <button
          type="button"
          disabled={busy || !data.legalName || !data.email}
          onClick={submit}
          className="mt-2 w-full rounded-[12px] bg-ink py-3 text-[14px] font-medium text-paper disabled:opacity-40"
        >
          {busy ? "Opretter…" : "Opret tenant + start setup"}
        </button>
      </div>
    </div>
  );
}
