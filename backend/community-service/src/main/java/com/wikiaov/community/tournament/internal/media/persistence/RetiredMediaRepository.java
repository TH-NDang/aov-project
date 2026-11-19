package com.wikiaov.community.tournament.internal.media.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface RetiredMediaRepository extends Repository<RetiredMediaAsset, UUID> {
    boolean existsById(UUID id);

    RetiredMediaAsset save(RetiredMediaAsset asset);

    /** Native: looks for the image id in the text of every jsonb document. */
    @Query(value = """
        SELECT count(*) FROM (
            SELECT content FROM tournament.team
            UNION ALL SELECT content FROM tournament.player
            UNION ALL SELECT content FROM tournament.tournament
            UNION ALL SELECT content FROM tournament.series
            UNION ALL SELECT content FROM tournament.roster_membership
            UNION ALL SELECT content FROM tournament.game
            UNION ALL SELECT published_snapshot FROM tournament.game
            UNION ALL SELECT snapshot FROM tournament.game_publication
        ) records WHERE lower(CAST(content AS text)) LIKE '%' || CAST(:id AS text) || '%'
        """, nativeQuery = true)
    long countReferences(UUID id);

    /**
     * Images of live records. Series, rosters and games hold no image of their own, and game publications only copy
     * these, so they are left to {@link #countReferences}, which is slow enough to run for one image at a time. Native
     * for the PostgreSQL regular expression over the jsonb text.
     */
    @Query(value = """
        SELECT pairs.asset FROM (
        SELECT DISTINCT found.owner, lower(m[2]) AS asset FROM (
            SELECT id AS owner, content AS body FROM tournament.team
            UNION ALL SELECT id, content FROM tournament.player
            UNION ALL SELECT id, content FROM tournament.tournament
        ) found, LATERAL regexp_matches(CAST(found.body AS text), '/(assets|media)/([0-9a-fA-F-]{36})/', 'g') m
        ) pairs
        """, nativeQuery = true)
    List<String> allReferences();
}
