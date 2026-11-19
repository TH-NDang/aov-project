-- The teams and players in the trash, as the community module may read them (spec 04, identities in the trash): the
-- untouched draft page of such an identity is in the trash with it and is left out of page lists and pickers. A view
-- reads the registry when asked, so restoring the identity brings its page back without another write.
CREATE VIEW tournament.trashed_identity AS
SELECT 'TEAM' AS kind, id FROM tournament.team WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'PLAYER', id FROM tournament.player WHERE deleted_at IS NOT NULL;
