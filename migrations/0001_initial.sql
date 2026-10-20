-- Store no names, email addresses, journals, or research dataset rows.
-- A random device session is hashed before storage. This is pseudonymous,
-- not anonymous: hosting infrastructure may still process network metadata.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consent_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('daily','phq9','gad7')),
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checkins_session_time ON checkins(session_id, created_at DESC);
CREATE TABLE IF NOT EXISTS plans (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('saved','tried','helpful','not-helpful')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, resource_id)
);
