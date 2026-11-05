package com.wikiaov.community.community.internal.social.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageLiveRepository extends JpaRepository<PageLive, UUID> {

    /** Broadcasts started after {@code since} on published community pages, newest first. */
    @Query(value = """
            SELECT l.* FROM community.page_live l JOIN community.page g ON g.id = l.page_id
            WHERE l.started_at > :since AND g.published_content IS NOT NULL AND g.kind <> 'CIRCUIT'
            ORDER BY l.started_at DESC, l.page_id
            """, countQuery = """
            SELECT count(*) FROM community.page_live l JOIN community.page g ON g.id = l.page_id
            WHERE l.started_at > :since AND g.published_content IS NOT NULL AND g.kind <> 'CIRCUIT'
            """, nativeQuery = true)
    Page<PageLive> active(Instant since, Pageable pageable);
}
