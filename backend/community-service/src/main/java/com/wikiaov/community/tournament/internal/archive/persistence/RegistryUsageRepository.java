package com.wikiaov.community.tournament.internal.archive.persistence;

import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Fixed registry graph queries; immutable game evidence is counted separately from active editorial references. */
public interface RegistryUsageRepository extends Repository<TeamRecord, UUID> {
    interface CountRow {
        String getType();

        long getCount();
    }

    @Query(value = """
        SELECT 'ROSTER_MEMBERSHIP' AS type,COUNT(*) AS count FROM tournament.roster_membership
         WHERE deleted_at IS NULL AND ((:kind='TEAM' AND team_id=:id)
             OR (:kind='PLAYER' AND player_id=:id) OR (:kind='TOURNAMENT' AND tournament_id=:id))
        UNION ALL
        SELECT 'SERIES',COUNT(*) FROM tournament.series
         WHERE deleted_at IS NULL AND ((:kind='TEAM' AND (content->>'teamAId'=CAST(:id AS text)
             OR content->>'teamBId'=CAST(:id AS text)))
             OR (:kind='TOURNAMENT' AND content->>'tournamentId'=CAST(:id AS text)))
        UNION ALL
        SELECT 'GAME',COUNT(*) FROM tournament.game game
         WHERE game.deleted_at IS NULL AND ((:kind='SERIES' AND game.series_id=:id)
             OR (:kind='TEAM' AND EXISTS(SELECT 1 FROM jsonb_array_elements(game.content->'sides') side
                 WHERE side->>'teamId'=CAST(:id AS text)))
             OR (:kind='PLAYER' AND EXISTS(SELECT 1 FROM jsonb_array_elements(game.content->'sides') side,
                 jsonb_array_elements(side->'participants') participant WHERE participant->>'playerId'=CAST(:id AS text))))
        UNION ALL
        SELECT 'PUBLICATION_HISTORY',COUNT(*) FROM tournament.game_publication
         WHERE (:kind='GAME' AND game_id=:id)
             OR (:kind='TEAM' AND jsonb_exists(snapshot->'teams',CAST(:id AS text)))
             OR (:kind='PLAYER' AND jsonb_exists(snapshot->'players',CAST(:id AS text)))
             OR (:kind='TOURNAMENT' AND snapshot->'series'->>'tournamentId'=CAST(:id AS text))
             OR (:kind='SERIES' AND snapshot->'content'->>'seriesId'=CAST(:id AS text))
        UNION ALL
        SELECT 'PUBLIC_GAME',COUNT(*) FROM tournament.game
         WHERE published_snapshot IS NOT NULL AND published_at IS NOT NULL AND ((:kind='GAME' AND id=:id)
             OR (:kind='TEAM' AND jsonb_exists(published_snapshot->'teams',CAST(:id AS text)))
             OR (:kind='PLAYER' AND jsonb_exists(published_snapshot->'players',CAST(:id AS text)))
             OR (:kind='TOURNAMENT' AND published_snapshot->'series'->>'tournamentId'=CAST(:id AS text))
             OR (:kind='SERIES' AND published_snapshot->'content'->>'seriesId'=CAST(:id AS text)))
        """, nativeQuery = true)
    List<CountRow> usages(String kind, UUID id);

    @Query(value = """
        SELECT CASE :kind
            WHEN 'TEAM' THEN (SELECT COUNT(*) FROM tournament.team WHERE id=:id AND deleted_at IS NULL)
            WHEN 'PLAYER' THEN (SELECT COUNT(*) FROM tournament.player WHERE id=:id AND deleted_at IS NULL)
            WHEN 'TOURNAMENT' THEN (SELECT COUNT(*) FROM tournament.tournament WHERE id=:id AND deleted_at IS NULL)
            WHEN 'SERIES' THEN (SELECT COUNT(*) FROM tournament.series WHERE id=:id AND deleted_at IS NULL)
            ELSE 0 END
        """, nativeQuery = true)
    long activeParents(String kind, UUID id);
}
