-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id   UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL,
  icon        TEXT,
  title       TEXT        NOT NULL,
  body        TEXT,
  action      TEXT,
  read        BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_person_id_idx ON notifications(person_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- Auto-clean: keep at most 100 notifications per person
CREATE OR REPLACE FUNCTION trim_notifications()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM notifications
  WHERE person_id = NEW.person_id
    AND id NOT IN (
      SELECT id FROM notifications
      WHERE person_id = NEW.person_id
      ORDER BY created_at DESC
      LIMIT 100
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_notifications ON notifications;
CREATE TRIGGER trg_trim_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION trim_notifications();

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (person_id = (
    SELECT id FROM people WHERE email = auth.email() LIMIT 1
  ));

DROP POLICY IF EXISTS "Users insert own notifications" ON notifications;
CREATE POLICY "Users insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (person_id = (
    SELECT id FROM people WHERE email = auth.email() LIMIT 1
  ));

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (person_id = (
    SELECT id FROM people WHERE email = auth.email() LIMIT 1
  ));

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (person_id = (
    SELECT id FROM people WHERE email = auth.email() LIMIT 1
  ));
