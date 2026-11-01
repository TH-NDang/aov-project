package com.wikiaov.community.tournament.internal.media.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface RetiredMediaRepository extends Repository<RetiredMediaAsset, UUID> {
    boolean existsById(UUID id);

    RetiredMediaAsset save(RetiredMediaAsset asset);

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
}
