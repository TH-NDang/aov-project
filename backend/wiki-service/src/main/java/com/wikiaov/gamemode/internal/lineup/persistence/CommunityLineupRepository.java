package com.wikiaov.gamemode.internal.lineup.persistence;

import com.wikiaov.gamemode.internal.lineup.domain.LineupStatus;
import com.wikiaov.gamemode.internal.lineup.persistence.entity.CommunityLineup;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CommunityLineupRepository extends JpaRepository<CommunityLineup, UUID> {
    Optional<CommunityLineup> findByIdAndModeId(UUID id, UUID modeId);

    List<CommunityLineup> findByModeIdAndAuthorIssuerAndAuthorSubjectOrderByUpdatedAtDesc(UUID modeId, String issuer,
            String subject);

    long countByModeIdAndAuthorIssuerAndAuthorSubject(UUID modeId, String issuer, String subject);

    Page<CommunityLineup> findByModeId(UUID modeId, Pageable pageable);

    Page<CommunityLineup> findByModeIdAndStatus(UUID modeId, LineupStatus status, Pageable pageable);

    /**
     * Visible lineups of a mode in ranking order. {@code sort} is {@code popular} (all likes), {@code trending} (likes
     * since {@code since}) or {@code recent}; ties fall back to the latest update. {@code unit} keeps lineups that
     * contain that unit when set.
     */
    @Query(nativeQuery = true, value = """
            select l.id from gamemode.community_lineup l
            left join (
                select k.lineup_id, count(*) as total, count(*) filter (where k.created_at >= :since) as recent
                from gamemode.lineup_like k where k.mode_id = :modeId group by k.lineup_id
            ) c on c.lineup_id = l.id
            where l.mode_id = :modeId and l.status = :visible
              and (cast(:unit as varchar) is null or exists (
                  select 1 from jsonb_array_elements(l.units) e where e ->> 'unitCode' = cast(:unit as varchar)))
            order by case cast(:sort as varchar)
                         when 'popular' then coalesce(c.total, 0)
                         when 'trending' then coalesce(c.recent, 0)
                         else 0 end desc,
                     l.updated_at desc, l.id
            limit :limit offset :offset
            """)
    List<UUID> rankedIds(UUID modeId, Instant since, String unit, String sort, int limit, long offset, String visible);

    default List<UUID> rankedIds(UUID modeId, Instant since, String unit, String sort, int limit, long offset) {
        return rankedIds(modeId, since, unit, sort, limit, offset, LineupStatus.VISIBLE.name());
    }

    @Query(nativeQuery = true, value = """
            select count(*) from gamemode.community_lineup l
            where l.mode_id = :modeId and l.status = :visible
              and (cast(:unit as varchar) is null or exists (
                  select 1 from jsonb_array_elements(l.units) e where e ->> 'unitCode' = cast(:unit as varchar)))
            """)
    long countVisible(UUID modeId, String unit, String visible);

    default long countVisible(UUID modeId, String unit) {
        return countVisible(modeId, unit, LineupStatus.VISIBLE.name());
    }
}
