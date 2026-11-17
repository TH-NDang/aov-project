package com.wikiaov.patch.internal.stats.persistence;

import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import com.wikiaov.patch.internal.stats.persistence.entity.PatchStatDefault;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PatchStatDefaultRepository extends JpaRepository<PatchStatDefault, UUID> {
    interface Effective {
        String getStatKey();

        BigDecimal getBaseValue();

        String getUnit();

        String getSourceUrl();

        UUID getVariantId();

        String getPatchCode();

        long getVersion();
    }

    Optional<PatchStatDefault> findByVariantIdAndStatKey(UUID variantId, String statKey);

    @Query(value = """
            select distinct on (d.stat_key) d.stat_key as "statKey", d.base_value as "baseValue", d.unit,
                d.source_url as "sourceUrl", d.variant_id as "variantId", p.code as "patchCode", d.version
            from patch.patch_variant target
            join patch.patch_variant v on v.ruleset_id = target.ruleset_id and v.ruleset_ordinal <= target.ruleset_ordinal
            join patch.stat_default d on d.variant_id = v.id
            join patch.game_patch p on p.id = v.patch_id
            where target.id = :id and (v.id = target.id or v.status = :published)
            order by d.stat_key, v.ruleset_ordinal desc
            """, nativeQuery = true)
    List<Effective> effective(UUID id, String published);

    /** The defaults a variant sees: its own, then those of published earlier variants of its ruleset. */
    default List<Effective> effective(UUID id) {
        return effective(id, PatchVariantStatus.PUBLISHED.name());
    }
}
