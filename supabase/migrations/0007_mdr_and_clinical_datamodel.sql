-- PraxisOS · Sprint 1 · MDR classification + kritisk klinisk data-model
-- Migration: 0007_mdr_and_clinical_datamodel.sql
-- Kontrakt: STATE-OF-THE-ART-MASTER-REPORT.md §3, §7 · MEDICAL-EXPERT-PANEL Armstrong/Boulton/Lavery
-- IKKE APPLIED til prod endnu · afventer Class-IIa CE-mark eller PRAXIS_CLINICAL_DEV=1

-- =============================================================================
-- 1. MDR classification per tenant (§3.2 legal blocker)
-- =============================================================================
-- Kliniske features må ikke aktiveres på tenants med mdr_status != 'ce_marked'.
-- Håndhæves i application-lag (feature-flag) + RLS-policy nedenfor.

ALTER TABLE IF EXISTS tenants
  ADD COLUMN IF NOT EXISTS mdr_status text NOT NULL DEFAULT 'none'
    CHECK (mdr_status IN ('none','pre_market','ce_marked')),
  ADD COLUMN IF NOT EXISTS mdr_notified_body text,           -- fx 'Presafe DK' | 'DEKRA'
  ADD COLUMN IF NOT EXISTS mdr_certificate_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS mdr_intended_use text;

CREATE INDEX IF NOT EXISTS tenants_mdr_status_idx ON tenants (mdr_status);

-- =============================================================================
-- 2. Neurological finding-datamodel (Armstrong CRITICAL · IWGDF 2023)
-- =============================================================================
-- Boulton, Diabetes Care 2022;45(4):1027-1043
-- IWGDF 2023 Practical Guidelines on prevention of foot ulcers

CREATE TABLE IF NOT EXISTS neurological_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id             uuid,
  scan_id               uuid REFERENCES scans(id) ON DELETE SET NULL,
  performed_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  performed_at          timestamptz NOT NULL DEFAULT now(),

  -- Semmes-Weinstein 10g monofilament (10-punkt protokol pr. fod)
  swmf_sites_tested     int  NOT NULL CHECK (swmf_sites_tested BETWEEN 0 AND 10),
  swmf_insensate_count  int  NOT NULL CHECK (swmf_insensate_count BETWEEN 0 AND 10),

  -- Vibration Perception Threshold (biothesiometer, volt-tærskel)
  vpt_hallux_volts      numeric(4,1) CHECK (vpt_hallux_volts IS NULL OR vpt_hallux_volts BETWEEN 0 AND 50),

  -- Ipswich Touch Test (0-6 correct sites)
  ipswich_touch_score   int CHECK (ipswich_touch_score IS NULL OR ipswich_touch_score BETWEEN 0 AND 6),

  -- Achilles-reflex
  achilles_reflex       text CHECK (achilles_reflex IS NULL OR achilles_reflex IN ('normal','reduced','absent')),

  -- Derived LOPS status
  lops_status           text NOT NULL CHECK (lops_status IN ('intact','present','severe')),

  foot_side             text NOT NULL CHECK (foot_side IN ('left','right')),
  notes                 text,

  -- INV-CS-11: ingen råt CPR i notes eller elsewhere
  CONSTRAINT neuro_no_raw_cpr CHECK (
    (notes IS NULL OR notes !~ '\m\d{6}-?\d{4}\M')
  )
);

ALTER TABLE neurological_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS neuro_isolation ON neurological_assessments;
CREATE POLICY neuro_isolation ON neurological_assessments
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS neuro_client_idx ON neurological_assessments (tenant_id, client_id, performed_at DESC);

-- =============================================================================
-- 3. Vascular assessment (Armstrong CRITICAL · WIfI-staging · SVS 2014)
-- =============================================================================
-- Mills JL et al. 'The SVS Lower Extremity Threatened Limb Classification System: WIfI'
-- J Vasc Surg 2014;59:220-234
-- Erstatter RGB-derived perfusion_index som var 'clinically indefensible' (Armstrong)

CREATE TABLE IF NOT EXISTS vascular_assessments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id             uuid,
  scan_id               uuid REFERENCES scans(id) ON DELETE SET NULL,
  performed_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  performed_at          timestamptz NOT NULL DEFAULT now(),
  foot_side             text NOT NULL CHECK (foot_side IN ('left','right')),

  -- Ankle-Brachial Index
  abi                   numeric(3,2) CHECK (abi IS NULL OR abi BETWEEN 0 AND 3),

  -- Toe-Brachial Index (mandatory when ABI > 1.3 pga medial calcification hos diabetikere)
  tbi                   numeric(3,2) CHECK (tbi IS NULL OR tbi BETWEEN 0 AND 2),

  -- TcPO2 dorsum foot (mmHg)
  tcpo2_dorsum          int CHECK (tcpo2_dorsum IS NULL OR tcpo2_dorsum BETWEEN 0 AND 100),

  -- Doppler waveforms
  waveform_dorsalis_pedis    text CHECK (waveform_dorsalis_pedis IS NULL OR waveform_dorsalis_pedis IN ('triphasic','biphasic','monophasic','absent')),
  waveform_posterior_tibial  text CHECK (waveform_posterior_tibial IS NULL OR waveform_posterior_tibial IN ('triphasic','biphasic','monophasic','absent')),

  -- Palpable pulses
  palpable_pulses       text CHECK (palpable_pulses IS NULL OR palpable_pulses IN ('both','dp_only','pt_only','neither')),

  -- Capillary refill time
  capillary_refill_seconds numeric(3,1) CHECK (capillary_refill_seconds IS NULL OR capillary_refill_seconds BETWEEN 0 AND 15),

  -- WIfI staging (Wound / Ischemia / foot Infection) — 0-3 each
  wifi_wound_grade      int CHECK (wifi_wound_grade IS NULL OR wifi_wound_grade BETWEEN 0 AND 3),
  wifi_ischemia_grade   int CHECK (wifi_ischemia_grade IS NULL OR wifi_ischemia_grade BETWEEN 0 AND 3),
  wifi_infection_grade  int CHECK (wifi_infection_grade IS NULL OR wifi_infection_grade BETWEEN 0 AND 3),

  notes                 text,

  CONSTRAINT vascular_no_raw_cpr CHECK (notes IS NULL OR notes !~ '\m\d{6}-?\d{4}\M'),

  -- Business-rule: hvis ABI > 1.3 skal TBI være målt (medial calcification-korrektion)
  CONSTRAINT vascular_tbi_required_when_abi_high
    CHECK (abi IS NULL OR abi <= 1.3 OR tbi IS NOT NULL)
);

ALTER TABLE vascular_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vascular_isolation ON vascular_assessments;
CREATE POLICY vascular_isolation ON vascular_assessments
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS vascular_client_idx ON vascular_assessments (tenant_id, client_id, performed_at DESC);

-- =============================================================================
-- 4. IWGDF risk stratification pr. klient (Bus, Diabetes Metab Res Rev 2024)
-- =============================================================================
-- Risk 0: no LOPS, no PAD                → annual screening
-- Risk 1: LOPS or foot deformity         → 6-12 month
-- Risk 2: LOPS + PAD                     → 3-6 month
-- Risk 3: prior ulcer or amputation      → 1-3 month (mandatory offloading plan)

CREATE TABLE IF NOT EXISTS iwgdf_risk_stratifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id             uuid NOT NULL,
  assessed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  assessed_at           timestamptz NOT NULL DEFAULT now(),

  risk_category         int  NOT NULL CHECK (risk_category BETWEEN 0 AND 3),

  -- Underlying factors driving stratification
  lops_present          boolean NOT NULL DEFAULT false,
  pad_present           boolean NOT NULL DEFAULT false,
  foot_deformity        boolean NOT NULL DEFAULT false,
  prior_ulcer           boolean NOT NULL DEFAULT false,
  prior_amputation      boolean NOT NULL DEFAULT false,
  esrd_dialysis         boolean NOT NULL DEFAULT false,

  next_screening_due    date,
  offloading_plan_ref   text,  -- reference til care-plan-dokument når risk >= 3
  notes                 text,

  CONSTRAINT iwgdf_no_raw_cpr CHECK (notes IS NULL OR notes !~ '\m\d{6}-?\d{4}\M'),

  -- IWGDF risk 3 MUST have offloading plan
  CONSTRAINT iwgdf_risk_3_needs_offloading
    CHECK (risk_category < 3 OR offloading_plan_ref IS NOT NULL)
);

ALTER TABLE iwgdf_risk_stratifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iwgdf_isolation ON iwgdf_risk_stratifications;
CREATE POLICY iwgdf_isolation ON iwgdf_risk_stratifications
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS iwgdf_client_idx ON iwgdf_risk_stratifications (tenant_id, client_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS iwgdf_screening_due_idx
  ON iwgdf_risk_stratifications (tenant_id, next_screening_due)
  WHERE next_screening_due IS NOT NULL;

-- =============================================================================
-- 5. Contralateral temperature monitoring
-- =============================================================================
-- Lavery LA et al. Diabetes Care 2007;30:14-20 (foundational)
-- Frykberg RG et al. Diabetes Care 2017;40:973-980 (SmartMat efficacy)
-- Podimetrics/SIREN/FLIR-ONE integration ready

CREATE TABLE IF NOT EXISTS temperature_readings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id             uuid NOT NULL,
  foot_side             text NOT NULL CHECK (foot_side IN ('left','right')),
  site                  text NOT NULL CHECK (site IN ('hallux','mth1','mth3','mth5','midfoot','heel')),
  temperature_c         numeric(4,1) NOT NULL CHECK (temperature_c BETWEEN 20 AND 45),
  device_source         text NOT NULL,   -- 'podimetrics-smartmat' | 'siren-sock' | 'flir-one' | 'clinic-thermometer'
  captured_at           timestamptz NOT NULL,

  -- Computed asymmetri vs kontralateralt site (fyldes af trigger eller downstream job)
  contralateral_delta_c numeric(4,1)
);

ALTER TABLE temperature_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temperature_isolation ON temperature_readings;
CREATE POLICY temperature_isolation ON temperature_readings
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS temperature_client_time_idx
  ON temperature_readings (tenant_id, client_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS temperature_alert_idx
  ON temperature_readings (tenant_id, client_id, site, foot_side, captured_at DESC)
  WHERE contralateral_delta_c IS NOT NULL AND abs(contralateral_delta_c) > 2.2;

-- =============================================================================
-- 6. Consent events (Corti DK 4-lags samtykke · HUMANIZED-FRONTIER §2.4)
-- =============================================================================
-- Sundhedsloven §42a-d + Databeskyttelseslovens §7 stk. 3
-- Immutable append-only table for legal audit

CREATE TABLE IF NOT EXISTS consent_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id             uuid,
  practitioner_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type            text NOT NULL CHECK (event_type IN (
                          'clinic_dpa_signed',
                          'physical_signage_confirmed',
                          'verbal_ack_recorded',
                          'wake_word_activated',
                          'consent_withdrawn'
                        )),
  captured_at           timestamptz NOT NULL DEFAULT now(),
  audio_snippet_url     text,          -- 2-sec audio for verbal_ack_recorded
  session_ref           text,          -- reference til realtime plane session
  metadata              jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT consent_no_raw_cpr CHECK (metadata::text !~ '\m\d{6}-?\d{4}\M')
);

-- Consent er append-only (aldrig UPDATE/DELETE i normal flow)
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_insert ON consent_events;
CREATE POLICY consent_insert ON consent_events
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS consent_select ON consent_events;
CREATE POLICY consent_select ON consent_events
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- No UPDATE / DELETE policies → append-only

CREATE INDEX IF NOT EXISTS consent_client_time_idx
  ON consent_events (tenant_id, client_id, captured_at DESC);

-- =============================================================================
-- 7. Trigger · auto-compute contralateral_delta_c ved INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION temperature_compute_contralateral_delta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contra_side text := CASE WHEN NEW.foot_side = 'left' THEN 'right' ELSE 'left' END;
  contra_temp numeric(4,1);
BEGIN
  -- Find seneste temperatur på kontralateralt site inden for 60 minutter
  SELECT temperature_c INTO contra_temp
  FROM temperature_readings
  WHERE tenant_id = NEW.tenant_id
    AND client_id = NEW.client_id
    AND site = NEW.site
    AND foot_side = contra_side
    AND captured_at BETWEEN (NEW.captured_at - interval '60 minutes') AND NEW.captured_at
  ORDER BY captured_at DESC
  LIMIT 1;

  IF contra_temp IS NOT NULL THEN
    NEW.contralateral_delta_c := NEW.temperature_c - contra_temp;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_temperature_delta ON temperature_readings;
CREATE TRIGGER trg_temperature_delta
  BEFORE INSERT ON temperature_readings
  FOR EACH ROW
  EXECUTE FUNCTION temperature_compute_contralateral_delta();

-- =============================================================================
-- 8. Rollback (kommenteret ud)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_temperature_delta ON temperature_readings;
-- DROP FUNCTION IF EXISTS temperature_compute_contralateral_delta();
-- DROP TABLE IF EXISTS consent_events;
-- DROP TABLE IF EXISTS temperature_readings;
-- DROP TABLE IF EXISTS iwgdf_risk_stratifications;
-- DROP TABLE IF EXISTS vascular_assessments;
-- DROP TABLE IF EXISTS neurological_assessments;
-- ALTER TABLE tenants
--   DROP COLUMN IF EXISTS mdr_status,
--   DROP COLUMN IF EXISTS mdr_notified_body,
--   DROP COLUMN IF EXISTS mdr_certificate_expires_at,
--   DROP COLUMN IF EXISTS mdr_intended_use;
