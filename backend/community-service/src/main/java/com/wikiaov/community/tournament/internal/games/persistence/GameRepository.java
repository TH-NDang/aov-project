package com.wikiaov.community.tournament.internal.games.persistence;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GameRepository extends JpaRepository<GameRecord, UUID> {
    /** A null id leaves its filter out. A game has a hero when a participant picked it; a ban does not count. */
    String PUBLIC = """
        from tournament.game where published_at is not null
          and (cast(:tournamentId as text) is null
               or published_snapshot->'series'->>'tournamentId'=cast(:tournamentId as text))
          and (cast(:seriesId as text) is null
               or published_snapshot->'content'->>'seriesId'=cast(:seriesId as text))
          and (cast(:heroId as text) is null
               or jsonb_path_exists(published_snapshot,'$.content.sides[*].participants[*].hero ? (@.id == $id)',
                                    jsonb_build_object('id',cast(:heroId as text))))
        """;

    /** The games of the latest match first, its last game before the others; a match without a day comes last. */
    String LATEST_FIRST = """
        order by published_snapshot->'series'->>'scheduledAt' desc nulls last,
                 cast(published_snapshot->'content'->>'number' as integer) desc, published_at desc, id
        """;

    /** Native: filters and orders by parts of the jsonb published snapshot. The page must carry no sort of its own. */
    @Query(value = "select * " + PUBLIC
            + LATEST_FIRST, countQuery = "select count(*) " + PUBLIC, nativeQuery = true)
    Page<GameRecord> findPublic(@Nullable String tournamentId, @Nullable String seriesId, @Nullable String heroId,
            Pageable page);

    Page<GameRecord> findBySeriesId(UUID seriesId, Pageable page);

    Page<GameRecord> findByPublishedAtIsNotNull(Pageable page);

    @Query("""
        SELECT game FROM GameRecord game WHERE (:seriesId IS NULL OR game.seriesId=:seriesId)
          AND (:tournamentId IS NULL OR game.seriesId IN
                (SELECT series.id FROM SeriesRecord series WHERE series.tournamentId=:tournamentId))
          AND (:state='ALL' OR (:state='ACTIVE' AND game.deletedAt IS NULL) OR (:state='DELETED' AND game.deletedAt IS NOT NULL))
        """)
    Page<GameRecord> search(UUID seriesId, UUID tournamentId, String state, Pageable page);

    /**
     * The role last recorded for each item of the wiki in the builds of games that are not deleted, the builds of the
     * hero first: [item id, role]. A step of the first lists has no role; its place says it.
     */
    @Query(value = """
        SELECT DISTINCT ON (step->'item'->>'id') step->'item'->>'id',
               coalesce(step->>'role', CASE step->>'place' WHEN 'SITUATIONAL' THEN 'PROTECTIVE' ELSE 'CORE' END)
          FROM tournament.game game
         CROSS JOIN LATERAL jsonb_array_elements(coalesce(game.content->'sides', '[]')) AS side
         CROSS JOIN LATERAL jsonb_array_elements(coalesce(side->'participants', '[]')) AS seat
         CROSS JOIN LATERAL jsonb_array_elements(coalesce(seat->'build', '[]')) AS step
         WHERE game.deleted_at IS NULL AND step->'item'->>'id' IS NOT NULL
         ORDER BY step->'item'->>'id', (seat->'hero'->>'id' = cast(:heroId as text)) DESC NULLS LAST,
                  game.updated_at DESC
        """, nativeQuery = true)
    List<Object[]> buildRoles(String heroId);
}
