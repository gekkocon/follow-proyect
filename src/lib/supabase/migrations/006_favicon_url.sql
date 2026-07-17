-- Fase 6B+ — favicon dinámico
ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;
