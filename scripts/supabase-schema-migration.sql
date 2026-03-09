-- Add data_payload column to existing table to support Snapshots 
ALTER TABLE ws_upload_history ADD COLUMN IF NOT EXISTS data_payload jsonb;
