package com.wikiaov.community.community.internal.social.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PageLiveRepository extends JpaRepository<PageLive, UUID> {

    /**
     * Broadcasts started after {@code since} on published pages, newest first. {@code editorialKind} names the kind of
     * page that has no community (circuits), which is left out.
     */
    @Query("""
            select l from PageLive l join PageRecord g on g.id = l.pageId
            where l.startedAt > :since and g.publishedContent is not null and g.kind <> :editorialKind
            order by l.startedAt desc, l.pageId
            """)
    Page<PageLive> active(Instant since, Kind editorialKind, Pageable pageable);
}
