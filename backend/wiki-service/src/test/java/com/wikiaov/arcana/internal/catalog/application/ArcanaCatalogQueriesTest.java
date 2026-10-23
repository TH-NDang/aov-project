package com.wikiaov.arcana.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.arcana.internal.catalog.persistence.ArcanaIdentityRepository;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaRevisionRepository;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaTranslationRepository;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaIdentity;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaTranslation;
import com.wikiaov.arcana.internal.change.persistence.ArcanaPatchChangeRepository;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class ArcanaCatalogQueriesTest {
    private final ArcanaPatchChangeRepository patchChanges = mock(ArcanaPatchChangeRepository.class);
    private final ArcanaIdentityRepository identities = mock(ArcanaIdentityRepository.class);
    private final ArcanaRevisionRepository revisions = mock(ArcanaRevisionRepository.class);
    private final ArcanaTranslationRepository translations = mock(ArcanaTranslationRepository.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final ArcanaRevisionContent content = mock(ArcanaRevisionContent.class);
    private final ArcanaContentRules rules = mock(ArcanaContentRules.class);
    private final ArcanaCatalogQueries queries = new ArcanaCatalogQueries(patchChanges, identities, revisions,
            translations, contexts, Clock.systemUTC(), content, rules);
    private final UUID rulesetId = UUID.randomUUID();

    @Test
    void rejectsInvalidPageBeforeResolvingRulesetOrLoadingContent() {
        assertThatThrownBy(() -> queries.list(rulesetId, "vi-VN", "", -1, 10))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
        verifyNoInteractions(contexts, revisions, translations, identities, content);
    }

    @Test
    void searchesEveryTranslationOfSelectedRevisionAndKeepsIdentityOrdering() {
        var first = owner("alpha");
        var second = owner("beta");
        var older = revision(first, 1);
        var selected = revision(first, 2);
        var other = revision(second, 1);
        var selectedCopy = translation(selected, "en", "Search target");
        var otherCopy = translation(other, "vi-VN", "Search target too");
        when(revisions.findByStateNot("DISCARDED")).thenReturn(List.of(older, selected, other));
        when(translations.findByRevisionIdIn(any())).thenReturn(List.of(selectedCopy, otherCopy));
        when(identities.findAll(Sort.by("code"))).thenReturn(List.of(first, second));
        when(content.hydrate(any(), any())).thenReturn(mock(ArcanaContent.class));

        var result = queries.list(rulesetId, "vi-VN", " TARGET ", 0, 1);

        assertThat(result.totalElements()).isEqualTo(2);
        assertThat(result.items()).extracting(row -> row.id()).containsExactly(first.getId());
        verify(translations).findByRevisionIdIn(argThat(ids -> ids.size() == 2
                && ids.contains(selected.getId()) && ids.contains(other.getId()) && !ids.contains(older.getId())));
        verify(content).hydrate(selected, List.of(selectedCopy));
        verifyNoInteractions(patchChanges);
    }

    @Test
    void oversizedPageIndexReturnsEmptyPageWithoutIntegerOverflow() {
        var owner = owner("alpha");
        var revision = revision(owner, 1);
        when(revisions.findByStateNot("DISCARDED")).thenReturn(List.of(revision));
        when(translations.findByRevisionIdIn(any())).thenReturn(List.of());
        when(identities.findAll(Sort.by("code"))).thenReturn(List.of(owner));

        var result = queries.list(null, "vi-VN", "", Integer.MAX_VALUE, 100);

        assertThat(result.items()).isEmpty();
        assertThat(result.totalElements()).isEqualTo(1);
        verifyNoInteractions(contexts, content);
    }

    @Test
    void missingCatalogIdentityWinsBeforeRevisionLookup() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> queries.read(id, UUID.randomUUID())).isInstanceOf(ApiException.class)
                .hasMessage("The catalog entry was not found.");
        verifyNoInteractions(revisions, content);
    }

    private ArcanaIdentity owner(String code) {
        var owner = new ArcanaIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        return owner;
    }

    private ArcanaRevision revision(ArcanaIdentity owner, long number) {
        var revision = new ArcanaRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(rulesetId);
        revision.setRevisionNo(number);
        revision.setState("DRAFT");
        revision.setCause("DATA_BASELINE");
        return revision;
    }

    private ArcanaTranslation translation(ArcanaRevision revision, String locale, String name) {
        var translation = new ArcanaTranslation();
        translation.setRevisionId(revision.getId());
        translation.setLocale(locale);
        translation.setName(name);
        return translation;
    }
}
