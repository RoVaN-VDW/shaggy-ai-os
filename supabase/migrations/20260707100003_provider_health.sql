-- Add health check columns to model_providers
ALTER TABLE public.model_providers
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE public.model_providers
SET health_status = COALESCE(health_status, 'unknown')
WHERE health_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_model_providers_status
  ON public.model_providers (status, health_status);
