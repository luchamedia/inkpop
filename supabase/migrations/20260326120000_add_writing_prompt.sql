-- Add writing prompt columns to sites table
-- writing_prompt: full system prompt text used at generation time
-- writing_prompt_inputs: structured form data for regenerating the prompt
ALTER TABLE sites ADD COLUMN IF NOT EXISTS writing_prompt text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS writing_prompt_inputs jsonb;
