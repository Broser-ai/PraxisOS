import { getServiceSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Replicate often needs a fetchable URL. Prefer Supabase Storage when configured;
 * otherwise pass through data URLs (supported by many Replicate models).
 */
export async function resolveScanImageUrl(input: {
  imageUrl?: string;
  imageBase64?: string;
  tenantId: string;
}): Promise<{ url: string; note: string }> {
  const direct = input.imageUrl?.trim() || "";
  const b64 = input.imageBase64?.trim() || "";

  if (direct && !direct.startsWith("data:") && /^https?:\/\//i.test(direct)) {
    return { url: direct, note: "Bruger offentlig image URL" };
  }

  const dataUrl = direct.startsWith("data:")
    ? direct
    : b64
      ? b64.startsWith("data:")
        ? b64
        : `data:image/jpeg;base64,${b64}`
      : "";

  if (!dataUrl) {
    return { url: "", note: "Ingen image" };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getServiceSupabase();
      if (supabase) {
        const raw = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Buffer.from(raw, "base64");
        const path = `${input.tenantId}/scans/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("scans").upload(path, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (!error) {
          const { data } = supabase.storage.from("scans").getPublicUrl(path);
          if (data?.publicUrl) {
            return { url: data.publicUrl, note: "Uploadet til Supabase Storage (scans)" };
          }
        }
      }
    } catch {
      // fall through to data URL
    }
  }

  return {
    url: dataUrl,
    note: "Sender data-URL til GPU (Supabase Storage ikke konfigureret)",
  };
}
