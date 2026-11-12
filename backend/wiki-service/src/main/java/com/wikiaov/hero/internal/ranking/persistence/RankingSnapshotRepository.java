package com.wikiaov.hero.internal.ranking.persistence;

import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface RankingSnapshotRepository
        extends
            JpaRepository<RankingSnapshotRow, UUID>,
            JpaSpecificationExecutor<RankingSnapshotRow> {
    boolean existsByCode(String code);

    /** Serializes review writes on one snapshot, so its open review count cannot change under a confirmation. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from RankingSnapshotRow s where s.id = :id")
    Optional<RankingSnapshotRow> lockById(UUID id);

    static Specification<RankingSnapshotRow> matching(String region, String mode) {
        return (root, query, builder) -> builder.and(
                region == null ? builder.conjunction() : builder.equal(root.get("regionCode"), region),
                mode == null ? builder.conjunction() : builder.equal(root.get("modeCode"), mode));
    }
}
