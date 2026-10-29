package com.wikiaov.terminology.internal.settings.persistence;

import com.wikiaov.terminology.internal.settings.persistence.entity.ReferenceTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReferenceTranslationRepository extends JpaRepository<ReferenceTranslation, UUID> {
    interface HeroAliases {
        String getReferenceKey();

        String getLocale();

        List<String> getAliases();
    }

    @Query("""
        SELECT entry.referenceKey AS referenceKey, text.locale AS locale, text.aliases AS aliases
          FROM ReferenceTranslation text JOIN ReferenceEntry entry ON entry.id=text.entryId
         WHERE entry.kind='hero'
        """)
    List<HeroAliases> heroAliases();
}
