package com.wikiaov.community.tournament.internal.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface PublishedOverviewRepository extends Repository<GameRecord, UUID> {
    interface SummaryRow {
        UUID getId();

        String getContentJson();

        long getGameCount();
    }

    @Query(value = """
        WITH observations AS (
            SELECT published_snapshot->'series'->>'tournamentId' AS group_id,
                   published_snapshot->'tournament' AS content, published_at,
                   COUNT(*) OVER (PARTITION BY published_snapshot->'series'->>'tournamentId') AS game_count,
                   ROW_NUMBER() OVER (PARTITION BY published_snapshot->'series'->>'tournamentId'
                                      ORDER BY published_at DESC,id DESC) AS position
              FROM tournament.game WHERE published_at IS NOT NULL AND published_snapshot IS NOT NULL
        )
        SELECT CAST(group_id AS uuid) AS id, CAST(content AS text) AS "contentJson", game_count AS "gameCount"
          FROM observations WHERE position=1 ORDER BY published_at DESC,group_id
        """, countQuery = """
        SELECT COUNT(DISTINCT published_snapshot->'series'->>'tournamentId')
          FROM tournament.game WHERE published_at IS NOT NULL AND published_snapshot IS NOT NULL
        """, nativeQuery = true)
    Page<SummaryRow> tournaments(Pageable page);

    @Query(value = """
        WITH observations AS (
            SELECT published_snapshot->'content'->>'seriesId' AS group_id,
                   published_snapshot->'series' AS content, published_at,
                   COUNT(*) OVER (PARTITION BY published_snapshot->'content'->>'seriesId') AS game_count,
                   ROW_NUMBER() OVER (PARTITION BY published_snapshot->'content'->>'seriesId'
                                      ORDER BY published_at DESC,id DESC) AS position
              FROM tournament.game WHERE published_at IS NOT NULL AND published_snapshot IS NOT NULL
               AND (CAST(:tournamentId AS text) IS NULL
                    OR published_snapshot->'series'->>'tournamentId'=CAST(:tournamentId AS text))
        )
        SELECT CAST(group_id AS uuid) AS id, CAST(content AS text) AS "contentJson", game_count AS "gameCount"
          FROM observations WHERE position=1 ORDER BY published_at DESC,group_id
        """, countQuery = """
        SELECT COUNT(DISTINCT published_snapshot->'content'->>'seriesId')
          FROM tournament.game WHERE published_at IS NOT NULL AND published_snapshot IS NOT NULL
           AND (CAST(:tournamentId AS text) IS NULL
                OR published_snapshot->'series'->>'tournamentId'=CAST(:tournamentId AS text))
        """, nativeQuery = true)
    Page<SummaryRow> series(String tournamentId, Pageable page);
}
