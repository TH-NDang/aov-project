package com.wikiaov.patch.internal.authoring.persistence;

import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GamePatchTranslationRepository extends JpaRepository<GamePatchTranslation, GamePatchTranslation.Key> {
    @Query("select t from GamePatchTranslation t where t.patchId=:patchId "
            + "order by case when t.locale=:locale then 0 when t.locale='vi-VN' then 1 else 2 end, t.locale")
    List<GamePatchTranslation> preferred(UUID patchId, String locale, Pageable page);
}
