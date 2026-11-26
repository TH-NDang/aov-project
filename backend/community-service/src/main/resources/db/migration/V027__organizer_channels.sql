-- Organizers are channels (spec 04, section of 26/11/2026). The Liquipedia import named the publisher, Garena,
-- as the organizer of tournaments whose own links name the YouTube channel that ran them. Each of those tournaments now
-- names the organization page of that channel instead, in its draft, its published snapshot and its plan history, and
-- the page "garena" is deleted once nothing names it any more.

-- The channel a YouTube address names, in one spelling: "channel/<id>", "@<handle>", "c/<name>" or "user/<name>", lower
-- case, without the scheme, host, tab or query. Any other address, such as a video, names no channel.
CREATE FUNCTION pg_temp.youtube_channel(url text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower((regexp_match(url, '^https?://(?:www\.|m\.)?youtube\.com/((?:channel|c|user)/[^/?#]+|@[^/?#]+)',
                             'i'))[1])
$$;

-- The links of a page or tournament document; a document without a list has none.
CREATE FUNCTION pg_temp.links(document jsonb) RETURNS SETOF jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT link FROM jsonb_array_elements(CASE WHEN jsonb_typeof(document -> 'links') = 'array'
                                             THEN document -> 'links' ELSE '[]'::jsonb END) link
$$;

-- A published snapshot or a snapshot of the plan history, naming another organizer page.
CREATE FUNCTION pg_temp.organized_by(snapshot jsonb, organizer jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT snapshot
      || jsonb_build_object('organizer', organizer)
      || CASE WHEN jsonb_typeof(snapshot -> 'plan') = 'object'
              THEN jsonb_build_object('plan', (snapshot -> 'plan')
                   || jsonb_build_object('organizerPageId', organizer -> 'id', 'organizer', organizer -> 'name'))
              ELSE '{}'::jsonb END
$$;

CREATE TEMPORARY TABLE publisher AS
SELECT id, CAST(id AS text) AS key FROM community.page WHERE kind = 'ORGANIZATION' AND code = 'garena';

-- The tournaments whose draft, published snapshot or plan history names the publisher, the trash included.
CREATE TEMPORARY TABLE named_publisher AS
SELECT plan.id
  FROM tournament.competition_plan plan, publisher
 WHERE plan.content ->> 'organizerPageId' = publisher.key
    OR plan.published_snapshot -> 'organizer' ->> 'id' = publisher.key
    OR plan.published_snapshot -> 'plan' ->> 'organizerPageId' = publisher.key
    OR EXISTS (SELECT 1 FROM tournament.plan_revision revision
                WHERE revision.tournament_id = plan.id
                  AND (revision.content -> 'organizer' ->> 'id' = publisher.key
                       OR revision.content -> 'plan' ->> 'organizerPageId' = publisher.key));

-- The global Arena of Valor channel has no page yet; when a tournament of the publisher links to it, it gets a draft.
INSERT INTO community.page (id, version, code, kind, entity_id, content, updated_at)
SELECT gen_random_uuid(), 0, 'arena-of-valor', 'ORGANIZATION', NULL, jsonb_build_object(
           'name', 'Arena of Valor',
           'country', '',
           'biography', 'Kênh YouTube chính thức của Arena of Valor.',
           'links', jsonb_build_array(jsonb_build_object(
               'label', 'YouTube Arena of Valor',
               'url', 'https://www.youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ',
               'official', true)),
           'sources', jsonb_build_array(jsonb_build_object(
               'label', 'Kênh YouTube Arena of Valor',
               'url', 'https://www.youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ',
               'checkedOn', '2026-11-26')),
           'history', '[]'::jsonb, 'achievements', '[]'::jsonb, 'roster', '[]'::jsonb, 'personRoles', '[]'::jsonb),
       now()
 WHERE EXISTS (SELECT 1 FROM named_publisher moved
                 JOIN tournament.tournament t ON t.id = moved.id, pg_temp.links(t.content) link
                WHERE pg_temp.youtube_channel(link ->> 'url') = 'channel/ucgykgvtbuy4onym2eh61zwq')
   AND NOT EXISTS (SELECT 1 FROM community.page page, pg_temp.links(page.content) link
                    WHERE page.kind = 'ORGANIZATION'
                      AND pg_temp.youtube_channel(link ->> 'url') = 'channel/ucgykgvtbuy4onym2eh61zwq')
   AND NOT EXISTS (SELECT 1 FROM community.page WHERE code = 'arena-of-valor');

-- The organization page of the channel each tournament links to, when its links name exactly one.
CREATE TEMPORARY TABLE organizer_channel AS
SELECT moved.id AS tournament_id, min(CAST(channel.id AS text)) AS channel_key
  FROM named_publisher moved
  JOIN tournament.tournament t ON t.id = moved.id
  CROSS JOIN LATERAL pg_temp.links(t.content) tournament_link
  JOIN community.page channel ON channel.kind = 'ORGANIZATION' AND channel.code <> 'garena'
  CROSS JOIN LATERAL pg_temp.links(channel.content) channel_link
 WHERE pg_temp.youtube_channel(channel_link ->> 'url') = pg_temp.youtube_channel(tournament_link ->> 'url')
 GROUP BY moved.id
HAVING count(DISTINCT channel.id) = 1;

-- What a snapshot says about the channel's page: published pages as readers see them, drafts as editors left them.
CREATE TEMPORARY TABLE channel_organizer AS
SELECT DISTINCT page.id, CAST(page.id AS text) AS key, page.content ->> 'name' AS draft_name,
       page.published_content IS NOT NULL AS published,
       jsonb_build_object('id', page.id, 'code', page.code,
                          'name', coalesce(page.published_content, page.content) ->> 'name',
                          'logoUrl', coalesce(page.published_content, page.content) -> 'avatarUrl',
                          'published', page.published_content IS NOT NULL) AS organizer
  FROM community.page page
  JOIN organizer_channel moved ON moved.channel_key = CAST(page.id AS text);

UPDATE tournament.competition_plan plan
   SET content = plan.content || jsonb_build_object('organizerPageId', channel.key, 'organizer', channel.draft_name),
       version = plan.version + 1
  FROM organizer_channel moved, channel_organizer channel, publisher
 WHERE plan.id = moved.tournament_id AND channel.key = moved.channel_key
   AND plan.content ->> 'organizerPageId' = publisher.key;

-- A snapshot only names a published page; one whose channel page is still a draft keeps the publisher.
UPDATE tournament.competition_plan plan
   SET published_snapshot = pg_temp.organized_by(plan.published_snapshot, channel.organizer)
  FROM organizer_channel moved, channel_organizer channel, publisher
 WHERE plan.id = moved.tournament_id AND channel.key = moved.channel_key AND channel.published
   AND (plan.published_snapshot -> 'organizer' ->> 'id' = publisher.key
        OR plan.published_snapshot -> 'plan' ->> 'organizerPageId' = publisher.key);

UPDATE tournament.plan_revision revision
   SET content = pg_temp.organized_by(revision.content, channel.organizer)
  FROM organizer_channel moved, channel_organizer channel, publisher
 WHERE revision.tournament_id = moved.tournament_id AND channel.key = moved.channel_key
   AND (revision.content -> 'organizer' ->> 'id' = publisher.key
        OR revision.content -> 'plan' ->> 'organizerPageId' = publisher.key);

-- The publisher's page goes when no document names it and nobody acts through it, as the delete of the Admin asks,
-- except that a page once published goes too: it never stood for a channel.
DO $$
DECLARE
    page_key text := (SELECT key FROM publisher);
    pattern text := '%' || (SELECT key FROM publisher) || '%';
BEGIN
    IF page_key IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM tournament.competition_plan
                WHERE CAST(content AS text) LIKE pattern OR CAST(published_snapshot AS text) LIKE pattern)
       OR EXISTS (SELECT 1 FROM tournament.plan_revision WHERE CAST(content AS text) LIKE pattern)
       OR EXISTS (SELECT 1 FROM tournament.tournament WHERE CAST(content AS text) LIKE pattern)
       OR EXISTS (SELECT 1 FROM tournament.series WHERE CAST(content AS text) LIKE pattern)
       OR EXISTS (SELECT 1 FROM community.page
                   WHERE CAST(id AS text) <> page_key
                     AND (CAST(content AS text) LIKE pattern OR CAST(published_content AS text) LIKE pattern))
       OR EXISTS (SELECT 1 FROM community.page_member WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.page_claim WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.page_invitation WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.post WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.follow WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.report WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.notification WHERE CAST(page_id AS text) = page_key)
       OR EXISTS (SELECT 1 FROM community.page_live WHERE CAST(page_id AS text) = page_key) THEN
        RAISE NOTICE 'Kept organization page garena: a record or community activity still names it.';
        RETURN;
    END IF;

    DELETE FROM community.page_audit WHERE CAST(page_id AS text) = page_key;
    DELETE FROM community.page WHERE CAST(id AS text) = page_key;
END
$$;

DROP TABLE channel_organizer, organizer_channel, named_publisher, publisher;
DROP FUNCTION pg_temp.organized_by(jsonb, jsonb), pg_temp.links(jsonb), pg_temp.youtube_channel(text);
