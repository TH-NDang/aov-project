package com.wikiaov.patch.internal.authoring.persistence;

import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface GamePatchTranslationRepository extends JpaRepository<GamePatchTranslation, GamePatchTranslation.Key> {
    List<GamePatchTranslation> findByPatchId(UUID patchId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update GamePatchTranslation t set t.title=:title where t.patchId=:patchId and t.locale=:locale")
    int rename(UUID patchId, String locale, String title);
}
