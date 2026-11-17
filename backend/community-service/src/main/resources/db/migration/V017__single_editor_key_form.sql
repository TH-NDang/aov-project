-- One form for the account that wrote a tournament row: the token's issuer and subject on two lines, as
-- CommunityActor builds it. Registry, roster and lifecycle writes used to join the two with "|", so the same person
-- was stored under two keys. The subject is what follows the last "|"; a key that already has a line break is kept.

UPDATE tournament.team SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.team SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.player SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.player SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.tournament SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.tournament SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.series SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.series SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.game SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.game SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.roster_membership SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.roster_membership SET deleted_by = regexp_replace(deleted_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(deleted_by, E'\n') = 0 AND strpos(deleted_by, '|') > 0;

UPDATE tournament.game_publication SET actor = regexp_replace(actor, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(actor, E'\n') = 0 AND strpos(actor, '|') > 0;

UPDATE tournament.competition_plan SET edited_by = regexp_replace(edited_by, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(edited_by, E'\n') = 0 AND strpos(edited_by, '|') > 0;
UPDATE tournament.plan_revision SET actor = regexp_replace(actor, '\|([^|]*)$', E'\n\\1')
 WHERE strpos(actor, E'\n') = 0 AND strpos(actor, '|') > 0;
