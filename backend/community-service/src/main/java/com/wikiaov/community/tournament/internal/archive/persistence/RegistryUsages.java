package com.wikiaov.community.tournament.internal.archive.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Fixed registry graph queries over the jsonb documents of every registry table; immutable game evidence is counted
 * separately from active editorial references.
 */
@Repository
public class RegistryUsages {
    public record CountRow(
            String type,
            long count
    ) {
    }

    private static final String USAGES = """
        SELECT 'ROSTER_MEMBERSHIP' AS type,COUNT(*) AS count FROM tournament.roster_membership
         WHERE deleted_at IS NULL AND ((:kind='TEAM' AND team_id=:id)
             OR (:kind='PLAYER' AND player_id=:id) OR (:kind='TOURNAMENT' AND tournament_id=:id))
        UNION ALL
        SELECT 'SERIES',COUNT(*) FROM tournament.series
         WHERE deleted_at IS NULL AND ((:kind='TEAM' AND (content->>'teamAId'=CAST(:id AS text)
             OR content->>'teamBId'=CAST(:id AS text)))
             OR (:kind='TOURNAMENT' AND content->>'tournamentId'=CAST(:id AS text)))
        UNION ALL
        SELECT 'TOURNAMENT_PART',COUNT(*) FROM tournament.tournament
         WHERE deleted_at IS NULL AND :kind='TOURNAMENT' AND parent_id=:id
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
        """;

    private static final String ACTIVE_PARENTS = """
        SELECT CASE :kind
            WHEN 'TEAM' THEN (SELECT COUNT(*) FROM tournament.team WHERE id=:id AND deleted_at IS NULL)
            WHEN 'PLAYER' THEN (SELECT COUNT(*) FROM tournament.player WHERE id=:id AND deleted_at IS NULL)
            WHEN 'TOURNAMENT' THEN (SELECT COUNT(*) FROM tournament.tournament WHERE id=:id AND deleted_at IS NULL)
            WHEN 'SERIES' THEN (SELECT COUNT(*) FROM tournament.series WHERE id=:id AND deleted_at IS NULL)
            ELSE 0 END
        """;

    private final EntityManager entities;

    public RegistryUsages(EntityManager entities) {
        this.entities = entities;
    }

    public List<CountRow> usages(String kind, UUID id) {
        List<Tuple> rows = entities.createNativeQuery(USAGES, Tuple.class).setParameter("kind", kind)
                .setParameter("id", id).getResultList();
        return rows.stream().map(row -> new CountRow(row.get("type", String.class),
                row.get("count", Number.class).longValue())).toList();
    }

    public long activeParents(String kind, UUID id) {
        return ((Number) entities.createNativeQuery(ACTIVE_PARENTS).setParameter("kind", kind).setParameter("id", id)
                .getSingleResult()).longValue();
    }
}
