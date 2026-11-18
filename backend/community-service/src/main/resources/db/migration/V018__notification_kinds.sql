-- A notification stores what happened as a kind code with its parameters; the reader's app words it in the reader's
-- language. Rows written before this keep the sentence they were sent with in message and have no kind.
ALTER TABLE community.notification
 ADD COLUMN kind varchar(40),
 ADD COLUMN parameters jsonb NOT NULL DEFAULT '{}',
 ALTER COLUMN message DROP NOT NULL,
 ADD CONSTRAINT notification_kind_or_message CHECK (kind IS NOT NULL OR message IS NOT NULL);
