package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinTranslationRepository extends JpaRepository<SkinTranslationRow, SkinTranslationRow.Key> {
    List<SkinTranslationRow> findBySkinSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
