package com.wikiaov.gamemode.internal.lineup.persistence;

import com.wikiaov.gamemode.internal.lineup.persistence.entity.LineupLike;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface LineupLikeRepository extends JpaRepository<LineupLike, LineupLike.Key> {

    /** Adds the like unless the reader already likes the lineup; returns the number of inserted rows. */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into gamemode.lineup_like (lineup_id, issuer, subject, mode_id, lineup_source, created_at)
            values (:lineupId, :issuer, :subject, :modeId, :source, :at)
            on conflict do nothing
            """)
    int insertIfAbsent(UUID lineupId, String issuer, String subject, UUID modeId, String source, Instant at);

    @Modifying
    @Query("delete from LineupLike l where l.id.lineupId = :lineupId and l.id.issuer = :issuer and l.id.subject = :subject")
    int deleteLike(UUID lineupId, String issuer, String subject);

    @Modifying
    @Query("delete from LineupLike l where l.id.lineupId = :lineupId")
    int deleteByLineup(UUID lineupId);

    @Query("select count(l) from LineupLike l where l.id.lineupId = :lineupId")
    long countByLineup(UUID lineupId);

    @Query("""
            select l.id.lineupId from LineupLike l
            where l.modeId = :modeId and l.id.issuer = :issuer and l.id.subject = :subject
            """)
    List<UUID> likedBy(UUID modeId, String issuer, String subject);

    @Query("""
            select new com.wikiaov.gamemode.internal.lineup.persistence.LikeTotals(
                l.id.lineupId, count(l), sum(case when l.createdAt >= :since then 1L else 0L end))
            from LineupLike l
            where l.modeId = :modeId and l.id.lineupId in :lineupIds
            group by l.id.lineupId
            """)
    List<LikeTotals> totals(UUID modeId, Instant since, Collection<UUID> lineupIds);
}
