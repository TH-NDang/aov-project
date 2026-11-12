package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.CaptureRow;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CaptureRepository extends JpaRepository<CaptureRow, UUID>, JpaSpecificationExecutor<CaptureRow> {
    boolean existsByCode(String code);

    /** Serializes writes on one capture, so its open review count cannot change under a confirmation. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CaptureRow c where c.id = :id")
    Optional<CaptureRow> lockById(UUID id);

    /** Confirmed captures of a market that list the hero, newest first. */
    @Query("""
            select c from CaptureRow c where c.regionCode = :region and c.confirmedAt is not null
            and exists (select h from CaptureHeroRow h where h.captureId = c.id and h.heroId = :heroId)
            order by c.capturedAt desc, c.id
            """)
    List<CaptureRow> confirmedWithHero(String region, UUID heroId);

    static Specification<CaptureRow> matching(String region, String source) {
        return (root, query, builder) -> builder.and(
                region == null ? builder.conjunction() : builder.equal(root.get("regionCode"), region),
                source == null ? builder.conjunction() : builder.equal(root.get("sourceKind"), source));
    }
}
