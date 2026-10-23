package com.wikiaov.hero.internal.profile.persistence;

import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileTranslationRepository extends JpaRepository<ProfileTranslationRow, ProfileTranslationRow.Key> {
    List<ProfileTranslationRow> findByProfileRevisionIdIn(Collection<UUID> ids, Sort sort);
}
