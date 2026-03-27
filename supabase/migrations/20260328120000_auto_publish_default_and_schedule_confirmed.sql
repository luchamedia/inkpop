-- Change auto_publish default to true for new sites
ALTER TABLE sites ALTER COLUMN auto_publish SET DEFAULT true;

-- Add schedule_confirmed flag for onboarding flow
ALTER TABLE sites ADD COLUMN IF NOT EXISTS schedule_confirmed boolean DEFAULT false;
