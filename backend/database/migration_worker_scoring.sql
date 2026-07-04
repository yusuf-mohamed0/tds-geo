-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════════════════════════
-- AI SEO Automation System — Worker Performance Scoring Migration
-- Adds performance scoring engine, tiered hierarchy, promotion/
-- demotion tracking, and configurable thresholds.
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- 1. WORKER PERFORMANCE SCORES (composite scores over time)
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE worker_tier AS ENUM ('elite', 'senior', 'standard', 'junior', 'probation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Composite performance scores computed from raw metrics
CREATE TABLE IF NOT EXISTS worker_performance_scores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_name       VARCHAR(255) NOT NULL,
  job_type          VARCHAR(100) NOT NULL,

  -- Raw metrics (aggregated from worker_performance)
  total_jobs        INTEGER DEFAULT 0,
  failed_jobs       INTEGER DEFAULT 0,
  avg_latency_ms    DOUBLE PRECISION,
  p95_latency_ms    DOUBLE PRECISION,
  throughput_per_min DOUBLE PRECISION,

  -- Composite dimension scores (0-100)
  reliability_score    DECIMAL(5,2) DEFAULT 50,  -- based on success rate
  throughput_score     DECIMAL(5,2) DEFAULT 50,  -- based on jobs/time
  latency_score        DECIMAL(5,2) DEFAULT 50,  -- based on processing speed
  cost_efficiency_score DECIMAL(5,2) DEFAULT 50, -- cost per job vs baseline
  quality_score        DECIMAL(5,2) DEFAULT 50,  -- AI evaluation of output

  -- Composite overall score (0-100)
  composite_score   DECIMAL(5,2) DEFAULT 50,

  -- Current tier assignment
  current_tier      worker_tier DEFAULT 'standard',
  tier_confidence   DECIMAL(5,2) DEFAULT 0.5,  -- confidence in tier assignment

  -- Tracking period
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,

  recorded_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wps_worker ON worker_performance_scores(worker_name);
CREATE INDEX IF NOT EXISTS idx_wps_tier ON worker_performance_scores(current_tier);
CREATE INDEX IF NOT EXISTS idx_wps_recorded ON worker_performance_scores(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_wps_composite ON worker_performance_scores(composite_score DESC);

-- ══════════════════════════════════════════════════════════════════
-- 2. WORKER HIERARCHY (current titles/ranks)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS worker_hierarchy (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_name       VARCHAR(255) NOT NULL UNIQUE,
  job_type          VARCHAR(100) NOT NULL,

  -- Current tier and title
  current_tier      worker_tier NOT NULL DEFAULT 'standard',
  title             VARCHAR(100) NOT NULL,  -- e.g. "Senior Content Generator" or "Elite SEO Analyst"

  -- Performance history
  current_score     DECIMAL(5,2) DEFAULT 50,
  highest_score     DECIMAL(5,2) DEFAULT 50,
  lowest_score      DECIMAL(5,2) DEFAULT 50,
  score_trend       VARCHAR(20) DEFAULT 'stable' CHECK (score_trend IN ('rising', 'stable', 'declining')),

  -- Consecutive periods tracking (for promotion/demotion logic)
  periods_at_tier   INTEGER DEFAULT 1,        -- consecutive scoring periods at current tier
  total_promotions  INTEGER DEFAULT 0,
  total_demotions   INTEGER DEFAULT 0,

  -- Status
  is_active         BOOLEAN DEFAULT true,
  last_score_at     TIMESTAMPTZ,
  last_promotion_at TIMESTAMPTZ,
  last_demotion_at  TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wh_tier ON worker_hierarchy(current_tier);
CREATE INDEX IF NOT EXISTS idx_wh_active ON worker_hierarchy(is_active);
CREATE INDEX IF NOT EXISTS idx_wh_score ON worker_hierarchy(current_score DESC);

-- ══════════════════════════════════════════════════════════════════
-- 3. PROMOTION / DEMOTION HISTORY
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE promotion_event_type AS ENUM ('promotion', 'demotion', 'flag_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS promotion_demotion_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_name       VARCHAR(255) NOT NULL,
  job_type          VARCHAR(100) NOT NULL,

  event_type        promotion_event_type NOT NULL,
  from_tier         worker_tier NOT NULL,
  to_tier           worker_tier NOT NULL,
  from_score        DECIMAL(5,2) NOT NULL,
  to_score          DECIMAL(5,2) NOT NULL,

  reason            TEXT NOT NULL,      -- Explanation of why promotion/demotion occurred
  trigger_metric    VARCHAR(100),       -- The key metric that triggered the change
  auto_applied      BOOLEAN DEFAULT true, -- false if manually overridden by admin

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdh_worker ON promotion_demotion_history(worker_name);
CREATE INDEX IF NOT EXISTS idx_pdh_event ON promotion_demotion_history(event_type);
CREATE INDEX IF NOT EXISTS idx_pdh_created ON promotion_demotion_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdh_tier ON promotion_demotion_history(from_tier, to_tier);

-- ══════════════════════════════════════════════════════════════════
-- 4. PERFORMANCE THRESHOLDS (configurable promotion/demotion rules)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS performance_thresholds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tier boundaries
  tier_name         worker_tier NOT NULL UNIQUE,
  min_score         DECIMAL(5,2) NOT NULL,  -- minimum composite score for this tier
  max_score         DECIMAL(5,2) NOT NULL,  -- maximum composite score for this tier

  -- Promotion / demotion rules
  promotion_threshold DECIMAL(5,2) NOT NULL,  -- score must exceed this to promote up
  demotion_threshold  DECIMAL(5,2) NOT NULL,  -- score must fall below this to demote down
  periods_for_promotion INTEGER DEFAULT 7,    -- consecutive periods above threshold
  periods_for_demotion  INTEGER DEFAULT 3,    -- consecutive periods below threshold

  -- Flags
  requires_approval BOOLEAN DEFAULT false,   -- true if promotion needs human approval

  -- Titles
  default_title     VARCHAR(100) NOT NULL,   -- e.g. "Elite Content Generator"

  -- Metadata
  weight_reliability   DECIMAL(3,2) DEFAULT 0.30,
  weight_throughput    DECIMAL(3,2) DEFAULT 0.15,
  weight_latency       DECIMAL(3,2) DEFAULT 0.15,
  weight_cost          DECIMAL(3,2) DEFAULT 0.15,
  weight_quality       DECIMAL(3,2) DEFAULT 0.25,

  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- 5. SEED DEFAULT THRESHOLDS
-- ══════════════════════════════════════════════════════════════════

INSERT INTO performance_thresholds (tier_name, min_score, max_score, promotion_threshold, demotion_threshold, periods_for_promotion, periods_for_demotion, default_title, weight_reliability, weight_throughput, weight_latency, weight_cost, weight_quality)
VALUES
  ('elite',     90, 100, 92, 85, 10, 3, 'Elite',     0.30, 0.15, 0.15, 0.15, 0.25),
  ('senior',    75,  89, 78, 70,  7, 3, 'Senior',    0.30, 0.15, 0.15, 0.15, 0.25),
  ('standard',  55,  74, 58, 50,  7, 3, 'Standard',  0.30, 0.15, 0.15, 0.15, 0.25),
  ('junior',    35,  54, 38, 30,  5, 3, 'Junior',    0.30, 0.15, 0.15, 0.15, 0.25),
  ('probation',  0,  34,  0,  0,  0, 0, 'Probation', 0.30, 0.15, 0.15, 0.15, 0.25)
ON CONFLICT (tier_name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ══════════════════════════════════════════════════════════════════
