BEGIN;

CREATE SCHEMA IF NOT EXISTS commoditynode;

CREATE OR REPLACE FUNCTION commoditynode.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE commoditynode.data_sources (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  publisher text NOT NULL CHECK (length(btrim(publisher)) > 0),
  category text NOT NULL CHECK (
    category IN (
      'market_quote',
      'official_statistics',
      'official_research',
      'news',
      'filing',
      'geospatial',
      'media'
    )
  ),
  homepage_url text NOT NULL CHECK (homepage_url ~ '^https://'),
  access_url text NOT NULL CHECK (access_url ~ '^https://'),
  transport text NOT NULL CHECK (transport IN ('api', 'download', 'html', 'rss', 'manual')),
  cadence text NOT NULL CHECK (
    cadence IN (
      'realtime',
      'intraday',
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'annual',
      'irregular'
    )
  ),
  attribution text NOT NULL CHECK (length(btrim(attribution)) > 0),
  editorial_owner text NOT NULL CHECK (length(btrim(editorial_owner)) > 0),
  operational_owner text NOT NULL CHECK (length(btrim(operational_owner)) > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commoditynode.rights_records (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  asset_scope text NOT NULL CHECK (
    asset_scope IN ('dataset', 'source', 'observation_series', 'media_asset')
  ),
  asset_id text NOT NULL CHECK (length(btrim(asset_id)) > 0),
  source_id text REFERENCES commoditynode.data_sources(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL CHECK (
    status IN ('approved', 'review_required', 'restricted', 'expired', 'rejected')
  ),
  license text,
  terms_url text NOT NULL CHECK (terms_url ~ '^https://'),
  public_display boolean NOT NULL DEFAULT false,
  redistribution boolean NOT NULL DEFAULT false,
  derivative_works boolean NOT NULL DEFAULT false,
  commercial_use boolean NOT NULL DEFAULT false,
  attribution_required boolean NOT NULL DEFAULT true,
  restrictions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(restrictions) = 'array'),
  evidence_record_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_record_ids) = 'array'
  ),
  reviewed_by text NOT NULL CHECK (length(btrim(reviewed_by)) > 0),
  reviewed_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_scope, asset_id),
  CHECK (expires_at IS NULL OR expires_at > reviewed_at),
  CHECK (NOT redistribution OR public_display),
  CHECK (status = 'approved' OR NOT public_display OR jsonb_array_length(restrictions) > 0)
);

CREATE TABLE commoditynode.instruments (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  commodity_id text NOT NULL CHECK (length(btrim(commodity_id)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  symbol text,
  instrument_type text NOT NULL CHECK (
    instrument_type IN (
      'physical_benchmark',
      'futures_contract',
      'official_statistic',
      'equity_proxy',
      'etf_proxy',
      'modeled_index'
    )
  ),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  unit text NOT NULL CHECK (length(btrim(unit)) > 0),
  relationship text NOT NULL CHECK (relationship IN ('direct', 'proxy', 'context', 'modeled')),
  provider_id text NOT NULL REFERENCES commoditynode.data_sources(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  delay_label text NOT NULL CHECK (length(btrim(delay_label)) > 0),
  proxy_semantics text NOT NULL CHECK (length(btrim(proxy_semantics)) > 0),
  caveat text NOT NULL CHECK (length(btrim(caveat)) > 0),
  rights_record_id text NOT NULL REFERENCES commoditynode.rights_records(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  last_reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    instrument_type NOT IN ('equity_proxy', 'etf_proxy')
    OR unit ~* '(share|security|index point)'
  )
);

CREATE TABLE commoditynode.observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id text NOT NULL REFERENCES commoditynode.instruments(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  source_id text NOT NULL REFERENCES commoditynode.data_sources(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  series_key text NOT NULL CHECK (length(btrim(series_key)) > 0),
  numeric_value numeric,
  text_value text,
  json_value jsonb,
  unit text NOT NULL CHECK (length(btrim(unit)) > 0),
  as_of timestamptz NOT NULL,
  source_published_at timestamptz,
  fetched_at timestamptz NOT NULL,
  stale_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  freshness_status text NOT NULL CHECK (
    freshness_status IN ('fresh', 'stale', 'expired', 'partial', 'unavailable')
  ),
  reason text,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, source_id, series_key, as_of, content_hash),
  CHECK (num_nonnulls(numeric_value, text_value, json_value) = 1),
  CHECK (fetched_at >= as_of),
  CHECK (stale_at >= fetched_at),
  CHECK (expires_at >= stale_at)
);

CREATE TABLE commoditynode.entities (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  entity_type text NOT NULL CHECK (
    entity_type IN (
      'Commodity',
      'Benchmark',
      'FinancialInstrument',
      'Country',
      'Region',
      'Mine',
      'ProcessingPlant',
      'Refinery',
      'Smelter',
      'Port',
      'Chokepoint',
      'TradeRoute',
      'StorageFacility',
      'Pipeline',
      'Company',
      'CompanySegment',
      'Industry',
      'FinalProduct',
      'Policy',
      'WeatherHazard',
      'Event',
      'Source'
    )
  ),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  latitude numeric CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  candidate boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE TABLE commoditynode.entity_aliases (
  entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  alias text NOT NULL CHECK (length(btrim(alias)) > 0),
  alias_normalized text NOT NULL CHECK (length(btrim(alias_normalized)) > 0),
  locale text NOT NULL DEFAULT 'und',
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, alias_normalized, locale)
);

CREATE TABLE commoditynode.assets (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  operator_entity_id text REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  asset_type text NOT NULL CHECK (
    asset_type IN (
      'mine',
      'processing_plant',
      'refinery',
      'smelter',
      'port',
      'storage',
      'pipeline',
      'route'
    )
  ),
  commodity_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(commodity_ids) = 'array'),
  capacity_value numeric CHECK (capacity_value IS NULL OR capacity_value >= 0),
  capacity_unit text,
  capacity_as_of date,
  source_record_id text,
  status text NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'reviewed', 'published', 'superseded', 'rejected')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((capacity_value IS NULL) = (capacity_unit IS NULL))
);

CREATE TABLE commoditynode.events (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  fingerprint text NOT NULL UNIQUE CHECK (fingerprint ~ '^cne_[a-f0-9]{8,64}$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  summary text NOT NULL CHECK (length(btrim(summary)) >= 80),
  occurred_at timestamptz NOT NULL,
  location_entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
  direction text NOT NULL CHECK (
    direction IN ('supply_negative', 'supply_positive', 'demand_negative', 'demand_positive', 'mixed')
  ),
  materiality text NOT NULL CHECK (materiality IN ('minor', 'notable', 'material', 'critical')),
  materiality_rationale text NOT NULL CHECK (length(btrim(materiality_rationale)) >= 80),
  status text NOT NULL CHECK (
    status IN ('candidate', 'reviewed', 'published', 'superseded', 'expired', 'rejected')
  ),
  is_fixture boolean NOT NULL DEFAULT false,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(unknowns) = 'array'
    AND (is_fixture OR jsonb_array_length(unknowns) > 0)
  ),
  published_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'published'
    OR (
      NOT is_fixture
      AND published_at IS NOT NULL
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE TABLE commoditynode.source_records (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  source_id text NOT NULL REFERENCES commoditynode.data_sources(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  publisher text NOT NULL CHECK (length(btrim(publisher)) > 0),
  url text NOT NULL CHECK (url ~ '^https://'),
  locator_type text NOT NULL CHECK (
    locator_type IN ('section', 'page', 'table', 'row', 'query', 'fragment', 'full_record')
  ),
  exact_locator text NOT NULL CHECK (length(btrim(exact_locator)) > 0),
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  content_hash text CHECK (content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'),
  archived_url text CHECK (archived_url IS NULL OR archived_url ~ '^https://'),
  reviewed_by text NOT NULL CHECK (length(btrim(reviewed_by)) > 0),
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commoditynode.claims (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  subject_entity_id text REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  event_id text REFERENCES commoditynode.events(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  claim_type text NOT NULL CHECK (
    claim_type IN ('verified_fact', 'reported_claim', 'analyst_inference', 'unknown')
  ),
  statement text NOT NULL CHECK (length(btrim(statement)) >= 20),
  status text NOT NULL CHECK (
    status IN ('candidate', 'reviewed', 'published', 'superseded', 'rejected')
  ),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  supersedes_claim_id text REFERENCES commoditynode.claims(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(subject_entity_id, event_id) >= 1),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (status <> 'published' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE commoditynode.claim_source_records (
  claim_id text NOT NULL REFERENCES commoditynode.claims(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  source_record_id text NOT NULL REFERENCES commoditynode.source_records(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  relationship text NOT NULL CHECK (relationship IN ('supports', 'contradicts', 'context')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, source_record_id, relationship)
);

CREATE TABLE commoditynode.ontology_edges (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  source_entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  target_entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  relation_type text NOT NULL CHECK (length(btrim(relation_type)) > 0),
  direction text NOT NULL CHECK (direction IN ('positive', 'negative', 'mixed', 'conditional')),
  directness text NOT NULL CHECK (directness IN ('direct', 'indirect')),
  strength_band text NOT NULL CHECK (strength_band IN ('low', 'medium', 'high')),
  confidence_band text NOT NULL CHECK (confidence_band IN ('limited', 'moderate', 'strong')),
  lag_min_days integer CHECK (lag_min_days IS NULL OR lag_min_days >= 0),
  lag_max_days integer CHECK (lag_max_days IS NULL OR lag_max_days >= 0),
  condition text,
  invalidation text NOT NULL CHECK (length(btrim(invalidation)) > 0),
  status text NOT NULL CHECK (
    status IN ('candidate', 'reviewed', 'published', 'superseded', 'rejected')
  ),
  valid_from timestamptz,
  valid_until timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_entity_id <> target_entity_id),
  CHECK (lag_max_days IS NULL OR lag_min_days IS NULL OR lag_max_days >= lag_min_days),
  CHECK (
    direction <> 'conditional'
    OR (condition IS NOT NULL AND length(btrim(condition)) > 0)
  ),
  CHECK (
    status <> 'published'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE TABLE commoditynode.edge_claims (
  edge_id text NOT NULL REFERENCES commoditynode.ontology_edges(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES commoditynode.claims(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (edge_id, claim_id)
);

CREATE TABLE commoditynode.graph_snapshots (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  ontology_version text NOT NULL CHECK (length(btrim(ontology_version)) > 0),
  root_entity_id text NOT NULL REFERENCES commoditynode.entities(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  event_id text REFERENCES commoditynode.events(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (root_entity_id, event_id, ontology_version, content_hash)
);

CREATE TABLE commoditynode.editorial_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_type text NOT NULL CHECK (
    record_type IN ('dataset', 'event', 'claim', 'media_asset', 'ontology_edge', 'page')
  ),
  record_id text NOT NULL CHECK (length(btrim(record_id)) > 0),
  action text NOT NULL CHECK (
    action IN (
      'request_sources',
      'request_rights',
      'send_to_editor',
      'submit_for_review',
      'approve',
      'publish',
      'supersede',
      'correct',
      'retract'
    )
  ),
  from_state text NOT NULL,
  to_state text NOT NULL,
  reviewer text NOT NULL CHECK (length(btrim(reviewer)) >= 3),
  note text NOT NULL CHECK (length(btrim(note)) >= 12),
  decision_hash text NOT NULL UNIQUE CHECK (decision_hash ~ '^[a-f0-9]{64}$'),
  decided_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commoditynode.media_assets (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  asset_type text NOT NULL CHECK (
    asset_type IN ('editorial_illustration', 'chart', 'map', 'photograph', 'icon')
  ),
  source_type text NOT NULL CHECK (
    source_type IN ('generated', 'owned', 'licensed', 'public_domain')
  ),
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  creator text NOT NULL CHECK (length(btrim(creator)) > 0),
  rights_record_id text NOT NULL REFERENCES commoditynode.rights_records(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  storage_key text NOT NULL UNIQUE CHECK (length(btrim(storage_key)) > 0),
  mime_type text NOT NULL CHECK (mime_type ~ '^(image|application)/'),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  ai_model text,
  visual_brief_hash text CHECK (visual_brief_hash IS NULL OR visual_brief_hash ~ '^[a-f0-9]{64}$'),
  disclosure text,
  alt_text text NOT NULL CHECK (length(btrim(alt_text)) > 0),
  reviewed_by text NOT NULL CHECK (length(btrim(reviewed_by)) > 0),
  reviewed_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > reviewed_at),
  CHECK (source_type <> 'generated' OR (ai_model IS NOT NULL AND visual_brief_hash IS NOT NULL))
);

CREATE TABLE commoditynode.corrections (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  publication_id text NOT NULL,
  correction_type text NOT NULL CHECK (
    correction_type IN ('minor_update', 'material_correction', 'retraction')
  ),
  before_summary text NOT NULL CHECK (length(btrim(before_summary)) > 0),
  after_summary text NOT NULL CHECK (length(btrim(after_summary)) > 0),
  affected_claim_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(affected_claim_ids) = 'array'
  ),
  invalidated_edge_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(invalidated_edge_ids) = 'array'
  ),
  responsible_editor text NOT NULL CHECK (length(btrim(responsible_editor)) > 0),
  issued_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commoditynode.publication_records (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  scope text NOT NULL CHECK (
    scope IN ('dataset', 'module', 'page', 'event', 'graph_snapshot', 'media_asset')
  ),
  record_id text NOT NULL CHECK (length(btrim(record_id)) > 0),
  state text NOT NULL CHECK (
    state IN ('candidate', 'reviewed', 'published', 'superseded', 'rejected')
  ),
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_ids) = 'array'),
  evidence_record_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_record_ids) = 'array'
  ),
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blockers) = 'array'),
  disclosure_required boolean NOT NULL DEFAULT false,
  allow_stale_with_disclosure boolean NOT NULL DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, record_id, version),
  CHECK (
    state <> 'published'
    OR (
      visibility = 'public'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND published_at IS NOT NULL
      AND jsonb_array_length(blockers) = 0
    )
  )
);

ALTER TABLE commoditynode.entity_aliases
  ADD CONSTRAINT entity_aliases_source_record_fk
  FOREIGN KEY (source_record_id) REFERENCES commoditynode.source_records(id)
  ON UPDATE CASCADE ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE commoditynode.assets
  ADD CONSTRAINT assets_source_record_fk
  FOREIGN KEY (source_record_id) REFERENCES commoditynode.source_records(id)
  ON UPDATE CASCADE ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE commoditynode.corrections
  ADD CONSTRAINT corrections_publication_fk
  FOREIGN KEY (publication_id) REFERENCES commoditynode.publication_records(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX observations_instrument_as_of_idx
  ON commoditynode.observations (instrument_id, as_of DESC);
CREATE INDEX observations_freshness_idx
  ON commoditynode.observations (freshness_status, expires_at);
CREATE INDEX entities_type_name_idx
  ON commoditynode.entities (entity_type, name);
CREATE INDEX entity_aliases_normalized_idx
  ON commoditynode.entity_aliases (alias_normalized);
CREATE INDEX events_status_occurred_idx
  ON commoditynode.events (status, occurred_at DESC);
CREATE INDEX source_records_source_retrieved_idx
  ON commoditynode.source_records (source_id, retrieved_at DESC);
CREATE INDEX claims_event_status_idx
  ON commoditynode.claims (event_id, status);
CREATE INDEX ontology_edges_source_status_idx
  ON commoditynode.ontology_edges (source_entity_id, status);
CREATE INDEX ontology_edges_target_status_idx
  ON commoditynode.ontology_edges (target_entity_id, status);
CREATE INDEX editorial_reviews_record_idx
  ON commoditynode.editorial_reviews (record_type, record_id, decided_at DESC);
CREATE INDEX publication_records_lookup_idx
  ON commoditynode.publication_records (scope, record_id, state, version DESC);

CREATE TRIGGER data_sources_set_updated_at
BEFORE UPDATE ON commoditynode.data_sources
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER rights_records_set_updated_at
BEFORE UPDATE ON commoditynode.rights_records
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER instruments_set_updated_at
BEFORE UPDATE ON commoditynode.instruments
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER entities_set_updated_at
BEFORE UPDATE ON commoditynode.entities
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER assets_set_updated_at
BEFORE UPDATE ON commoditynode.assets
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON commoditynode.events
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER claims_set_updated_at
BEFORE UPDATE ON commoditynode.claims
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER ontology_edges_set_updated_at
BEFORE UPDATE ON commoditynode.ontology_edges
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON commoditynode.media_assets
FOR EACH ROW EXECUTE FUNCTION commoditynode.set_updated_at();

CREATE VIEW commoditynode.published_event_snapshots AS
SELECT
  event.id,
  event.fingerprint,
  event.title,
  event.summary,
  event.occurred_at,
  event.location_entity_id,
  event.event_type,
  event.direction,
  event.materiality,
  event.materiality_rationale,
  event.unknowns,
  event.published_at,
  event.reviewed_by,
  event.reviewed_at
FROM commoditynode.events AS event
WHERE event.status = 'published'
  AND event.is_fixture = false
  AND event.reviewed_by IS NOT NULL
  AND event.reviewed_at IS NOT NULL
  AND event.published_at IS NOT NULL;

REVOKE ALL ON SCHEMA commoditynode FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA commoditynode FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA commoditynode FROM PUBLIC;
REVOKE UPDATE, DELETE ON commoditynode.editorial_reviews FROM PUBLIC;

COMMENT ON SCHEMA commoditynode IS
  'CommodityNode durable registry, evidence, graph, rights, editorial, and publication data.';
COMMENT ON TABLE commoditynode.editorial_reviews IS
  'Append-only named decisions. Application roles must not receive UPDATE or DELETE.';
COMMENT ON VIEW commoditynode.published_event_snapshots IS
  'Fail-closed event view: fixtures and unreviewed records are excluded.';

COMMIT;
