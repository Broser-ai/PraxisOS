// Kuraterede læringsartikler (INV-EL-2: alle med source_url).
// Kontrakt: docs/harness/EPIC-4-ELearning.md §1.1

import type { LearningContent } from "./schema";

export const LEARNING_CORPUS: LearningContent[] = [
  {
    id: "lc_da_hallux_valgus_basic",
    title: "Hvad er hallux valgus?",
    body_md:
      "Hallux valgus er en fejlstilling af storetåen, hvor tåen bøjer indad mod de andre tæer. [ref: Sundhedsstyrelsen]",
    tags: ["hallux_valgus", "biomekanik", "basis"],
    source_url: "https://www.sundhed.dk/borger/patienthaandbogen/hoft-ben-fod/hallux-valgus/",
    language: "da",
  },
  {
    id: "lc_da_diabetisk_fodpleje",
    title: "Daglig fodpleje ved diabetes",
    body_md:
      "Ved diabetes bør fødderne tjekkes dagligt for sår, blister og hyperkeratose. Perfusionen kan være nedsat. [ref: DSAM 2023]",
    tags: ["diabetes", "fodpleje", "forebyggelse"],
    source_url: "https://vejledninger.dsam.dk/type2/?mode=visKapitel&cid=907",
    language: "da",
  },
  {
    id: "lc_da_ortose_indlaering",
    title: "Sådan tilvænner du dig et nyt ortose-indlæg",
    body_md:
      "Ortose-indlæg skal tilvænnes gradvist: 1 time første dag, +1 time pr. dag, indtil du kan bruge det hele dagen. [ref: NHS orthotics guidelines]",
    tags: ["ortose", "tilvænning", "praktisk"],
    source_url: "https://www.nhs.uk/conditions/orthotics/",
    language: "da",
  },
  {
    id: "lc_da_callus_hyperkeratose",
    title: "Callus og hyperkeratose — hvorfor opstår det?",
    body_md:
      "Callus (hård hud) opstår som beskyttelse mod tryk. Findes ofte under metatarsalhoveder ved fejlstilling. [ref: Journal of Foot and Ankle Research]",
    tags: ["callus", "hyperkeratose", "biomekanik"],
    source_url: "https://jfootankleres.biomedcentral.com/",
    language: "da",
  },
  {
    id: "lc_da_gang_afvikling",
    title: "Normal gang-afvikling: hæl → midtfod → forfod",
    body_md:
      "Normal gang starter med hælislag, ruller over midtfoden og afvikler over forfoden. Afvigelser giver overbelastning. [ref: Perry & Burnfield 2010]",
    tags: ["gang", "biomekanik", "basis"],
    source_url: "https://www.ncbi.nlm.nih.gov/books/NBK540926/",
    language: "da",
  },
  {
    id: "lc_en_diabetic_foot_care",
    title: "Daily foot care for people with diabetes",
    body_md:
      "In diabetes, check feet daily for wounds, blisters and hyperkeratosis. Perfusion may be reduced. [ref: NICE NG19]",
    tags: ["diabetes", "foot_care", "prevention"],
    source_url: "https://www.nice.org.uk/guidance/ng19",
    language: "en",
  },
];

export function findContentByTags(tags: string[], language: "da" | "en"): LearningContent[] {
  const lowerTags = tags.map((t) => t.toLowerCase());
  return LEARNING_CORPUS.filter(
    (c) =>
      c.language === language &&
      c.tags.some((t) => lowerTags.includes(t.toLowerCase())),
  );
}

export function getContentById(id: string): LearningContent | undefined {
  return LEARNING_CORPUS.find((c) => c.id === id);
}
