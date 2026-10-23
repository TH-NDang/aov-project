package com.wikiaov.spell.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.spell.internal.catalog.persistence.SpellIdentityRepository;
import com.wikiaov.spell.internal.catalog.persistence.SpellRevisionRepository;
import com.wikiaov.spell.internal.catalog.persistence.SpellTranslationRepository;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellTranslation;
import com.wikiaov.spell.internal.change.persistence.SpellPatchChangeRepository;
import com.wikiaov.spell.internal.change.persistence.SpellRemovalRepository;
import com.wikiaov.spell.internal.domain.SpellContent;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class SpellCatalogQueriesTest {
    private final SpellPatchChangeRepository patchChanges = mock(SpellPatchChangeRepository.class);
    private final SpellIdentityRepository identities = mock(SpellIdentityRepository.class);
    private final SpellRevisionRepository revisions = mock(SpellRevisionRepository.class);
    private final SpellTranslationRepository translations = mock(SpellTranslationRepository.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final SpellRevisionContent content = mock(SpellRevisionContent.class);
    private final SpellContentRules rules = mock(SpellContentRules.class);
    private final SpellCatalogQueries queries = new SpellCatalogQueries(patchChanges, identities, revisions,
            translations, mock(SpellRemovalRepository.class), contexts, Clock.systemUTC(), content, rules);
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
        when(content.hydrate(any(), any())).thenReturn(mock(SpellContent.class));

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

    private SpellIdentity owner(String code) {
        var owner = new SpellIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        return owner;
    }

    private SpellRevision revision(SpellIdentity owner, long number) {
        var revision = new SpellRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(rulesetId);
        revision.setRevisionNo(number);
        revision.setState("DRAFT");
        revision.setCause("DATA_BASELINE");
        return revision;
    }

    private SpellTranslation translation(SpellRevision revision, String locale, String name) {
        var translation = new SpellTranslation();
        translation.setRevisionId(revision.getId());
        translation.setLocale(locale);
        translation.setName(name);
        return translation;
    }
}
