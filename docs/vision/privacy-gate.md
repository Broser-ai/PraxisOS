# Privacy-gate · Del Pilar Nexus vision

**Status:** bindende for Broser  
**Må ikke ændres af agenter uden navngiven menneskelig godkendelse**  
**Relateret:** `model-governance.md`, `model-registry.md`

## Formål

Sikre at kliniske fod-billeder (GDPR art. 9) ikke forlader den godkendte
behandlingsvej, før DPA, residens-review, retention-politik og navngiven
menneskelig godkendelse er på plads.

## Absolutte regler

### 1. Upload er blokeret som standard

Upload af kliniske billeder til et eksternt vision-mål er **blokeret**, medmindre
**alle** følgende er opfyldt og registreret:

1. Målprojektet er **privat** (ikke offentligt Universe-projekt til træning/deling).
2. Den **godkendte EU data-processing route** er dokumenteret (processor, region,
   formål, retsgrundlag).
3. Der findes en underskrevet **DPA** (databehandleraftale) med processoren.
4. **Residens-review** er gennemført (data forbliver i godkendt EU-region).
5. **Retention-politik** er angivet (hvornår slettes inference-input/output).
6. En **navngiven menneskelig godkender** (Broser) har skrevet et audit-event.

### 2. Forbudte destinationer indtil godkendelse

Kliniske billeder må **ikke** sendes til:

- offentlige Roboflow Universe-projekter,
- Roboflow Serverless Cloud uden godkendt EU-route + DPA,
- Replicate,
- tredjeparts image-URL’er / CDN’er uden for den godkendte route,

før DPA, residens-review, retention-politik og navngiven menneskelig godkendelse
eksisterer og er registreret.

> **Bemærk:** Den nuværende drift med Universe-model-ID’er og Replicate er en
> **legacy/undtagelsesstatus** dokumenteret i `model-registry.md`. Denne gate
> må ikke omgås ved at tilføje nye destinationer. Nye flows skal følge denne
> fil. Ændring af produktionskonfiguration er **uden for scope** for denne
> dokumentationsopgave.

### 3. Base64 ændrer ikke processor/residens

At sende billedet som **base64 i request-body** (i stedet for en offentlig URL)
ændrer **ikke**:

- hvem der er databehandler,
- hvor data fysisk behandles,
- om DPA/residens-krav er opfyldt.

Base64 er transportformat — ikke en privacy-kontrol.

### 4. Øvrige fail-closed krav

- Ingen trænings-upload / “improve this model” uden særskilt Broser-godkendelse.
- EXIF og enhedsidentifikatorer strippes før eventuel lagring uden for klinik-host.
- Secrets (`ROBOFLOW_API_KEY`, `REPLICATE_API_TOKEN`) kun i `/data/secrets.json`
  eller server-env — aldrig i git eller klient-bundles.
- Logs må ikke indeholde rå base64-billeder eller fulde API-nøgler.
- Tenant-isolation i storage-stier (`{tenantId}/scans/...`).

## Checklist før ny ekstern vision-route

- [ ] Privat projekt / privat endpoint
- [ ] EU data-processing route dokumenteret
- [ ] DPA på plads
- [ ] Residens-review bestået
- [ ] Retention-politik skrevet
- [ ] Navngiven godkender + immutable audit-event
- [ ] Model registreret i `model-registry.md` med status `shadow` eller strammere
