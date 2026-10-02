ALTER TABLE users ADD COLUMN session_version integer NOT NULL DEFAULT 0;

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens USING btree (user_id);
CREATE INDEX password_reset_tokens_expiry_idx ON password_reset_tokens USING btree (expires_at);
