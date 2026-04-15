-- Add profile image URL to participants (populated during Spotify OAuth)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
