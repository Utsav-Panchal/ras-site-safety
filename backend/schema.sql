-- Site Safety Forms: database schema (PostgreSQL)
-- Run by `npm run seed` (it drops and recreates everything, so only use it on a demo database).

DROP TABLE IF EXISTS activity_log, admin_notes, photos, submissions, sites, users CASCADE;

CREATE TABLE users (
                       id             SERIAL PRIMARY KEY,
                       username       VARCHAR(50)  NOT NULL UNIQUE,
                       password_hash  TEXT         NOT NULL,
                       full_name      VARCHAR(100) NOT NULL,
                       role           VARCHAR(10)  NOT NULL CHECK (role IN ('FRAMER', 'ADMIN')),
                       created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sites (
                       id          SERIAL PRIMARY KEY,
                       name        VARCHAR(120) NOT NULL UNIQUE,
                       address     VARCHAR(200),
                       created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
                             id                 SERIAL PRIMARY KEY,
                             user_id            INTEGER NOT NULL REFERENCES users(id),
                             site_id            INTEGER NOT NULL REFERENCES sites(id),
                             form_date          DATE    NOT NULL,

    -- checklist: one yes/no column per item
                             hard_hat           BOOLEAN NOT NULL,
                             vest               BOOLEAN NOT NULL,
                             boots              BOOLEAN NOT NULL,
                             eye_protection     BOOLEAN NOT NULL,
                             fall_protection    BOOLEAN NOT NULL,
                             ladders_inspected  BOOLEAN NOT NULL,
                             tools_ok           BOOLEAN NOT NULL,
                             hazards_identified BOOLEAN NOT NULL,

                             notes              TEXT,
                             status             VARCHAR(10) NOT NULL CHECK (status IN ('COMPLIANT', 'FLAGGED')),

    -- admin review of flagged forms
                             resolved_at        TIMESTAMPTZ,
                             resolved_by        INTEGER REFERENCES users(id),

                             created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- one form per worker, per site, per day
                             UNIQUE (user_id, site_id, form_date)
);
CREATE INDEX idx_submissions_date ON submissions (form_date DESC);
CREATE INDEX idx_submissions_site ON submissions (site_id);

-- Photos are stored inside PostgreSQL (bytea) so they survive on Netlify,
-- where function disks are temporary.
CREATE TABLE photos (
                        id             SERIAL PRIMARY KEY,
                        submission_id  INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                        filename       VARCHAR(200) NOT NULL,
                        mime_type      VARCHAR(50)  NOT NULL,
                        size_bytes     INTEGER      NOT NULL,
                        data           BYTEA        NOT NULL,
                        created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_submission ON photos (submission_id);

-- Private follow-up notes written by admins
CREATE TABLE admin_notes (
                             id             SERIAL PRIMARY KEY,
                             submission_id  INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                             author_id      INTEGER NOT NULL REFERENCES users(id),
                             body           TEXT    NOT NULL,
                             created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who did what. No foreign key to submissions on purpose,
-- so the log still shows a form after it has been deleted.
CREATE TABLE activity_log (
                              id             SERIAL PRIMARY KEY,
                              actor_id       INTEGER REFERENCES users(id),
                              action         VARCHAR(20) NOT NULL CHECK (action IN ('SUBMITTED', 'RESOLVED', 'NOTE', 'DELETED')),
  submission_id  INTEGER,
  message        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_created ON activity_log (created_at DESC);