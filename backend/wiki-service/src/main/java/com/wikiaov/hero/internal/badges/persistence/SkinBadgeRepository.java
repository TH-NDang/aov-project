package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadge;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeTranslation;
import com.wikiaov.platform.LikePatterns;
import jakarta.persistence.LockModeType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SkinBadgeRepository extends JpaRepository<SkinBadge, UUID>, JpaSpecificationExecutor<SkinBadge> {
    Optional<SkinBadge> findByCode(String code);

    @Query("select b.code from SkinBadge b")
    List<String> codes();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SkinBadge b where b.id = :id")
    Optional<SkinBadge> lock(UUID id);

    /**
     * Badges of one group, or without a group, whose code or a display name contains {@code search}; a blank search
     * keeps every badge.
     */
    static Specification<SkinBadge> listed(@Nullable UUID groupId, boolean ungrouped, String search) {
        return (root, query, builder) -> {
            List<Predicate> where = new ArrayList<>();
            if (groupId != null) {
                where.add(builder.equal(root.get("groupId"), groupId));
            }
            if (ungrouped) {
                where.add(builder.isNull(root.get("groupId")));
            }
            if (!search.isBlank()) {
                String pattern = LikePatterns.contains(search);
                var named = query.subquery(UUID.class);
                var text = named.from(SkinBadgeTranslation.class);
                named.select(text.get("badgeId")).where(builder.equal(text.get("badgeId"), root.get("id")),
                        builder.like(builder.lower(text.get("displayName")), pattern, LikePatterns.ESCAPE));
                where.add(builder.or(builder.like(builder.lower(root.get("code")), pattern, LikePatterns.ESCAPE),
                        builder.exists(named)));
            }
            return builder.and(where.toArray(Predicate[]::new));
        };
    }
}
