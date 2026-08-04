import { NEMSMS_TEMPLATES, type NemSmsCategory } from "@/lib/nemsms";

export function renderTemplate(
  category: NemSmsCategory,
  vars: Record<string, string>,
): { title: string; body: string; allowed: boolean } {
  const tpl = NEMSMS_TEMPLATES[category];
  let body = tpl.body;
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{${k}}`, v);
  }
  return { title: tpl.title, body, allowed: tpl.allowed };
}
