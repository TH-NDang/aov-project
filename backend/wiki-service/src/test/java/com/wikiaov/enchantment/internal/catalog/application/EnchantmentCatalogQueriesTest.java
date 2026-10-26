package com.wikiaov.enchantment.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentIdentityRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentTranslationRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentTranslation;
import com.wikiaov.enchantment.internal.change.persistence.EnchantmentPatchChangeRepository;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class EnchantmentCatalogQueriesTest {
    private final EnchantmentPatchChangeRepository patchChanges = mock(EnchantmentPatchChangeRepository.class);
    private final EnchantmentIdentityRepository identities = mock(EnchantmentIdentityRepository.class);
    private final EnchantmentRevisionRepository revisions = mock(EnchantmentRevisionRepository.class);
    private final EnchantmentTranslationRepository translations = mock(EnchantmentTranslationRepository.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final EnchantmentRevisionContent content = mock(EnchantmentRevisionContent.class);
    private final EnchantmentContentRules rules = mock(EnchantmentContentRules.class);
    private final EnchantmentPublicMedia publicMedia = mock(EnchantmentPublicMedia.class);
    private final EnchantmentCatalogQueries queries = new EnchantmentCatalogQueries(translations, patchChanges,
            identities, revisions, contexts, Clock.systemUTC(), content, rules, publicMedia);
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
        when(content.hydrate(any(), any())).thenReturn(mock(EnchantmentContent.class));

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

    @Test
    void historicalScopeOmitsUnknownPatchObservationsUntilExplicitlyRequested() {
        var owner = owner("baseline");
        var revision = revision(owner, 1);
        revision.setState("PUBLISHED");
        var season = UUID.randomUUID();
        var context = mock(GameplayContext.class);
        when(context.rulesetId()).thenReturn(rulesetId);
        when(contexts.resolveCatalog(eq("VN"), any(), eq(season), isNull())).thenReturn(context);
        when(identities.findAll(Sort.by("code"))).thenReturn(List.of(owner));
        when(identities.findById(owner.getId())).thenReturn(java.util.Optional.of(owner));
        when(revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId())).thenReturn(List.of(revision));
        when(publicMedia.hydrate(anyList())).thenAnswer(call -> call.getArgument(0));

        var hidden = queries.published("VN", "vi-VN", 0, 20, season, null, false);
        assertThat(hidden.items()).isEmpty();
        assertThat(hidden.totalElements()).isZero();
        assertThatThrownBy(() -> queries.publishedOne(owner.getId(), "VN", "vi-VN", season, null, false))
                .isInstanceOf(ApiException.class).hasMessage("No published snapshot is available.");
        verifyNoInteractions(content);

        var view = new EnchantmentView(owner.getId(), owner.getCode(), null, null, List.of());
        when(content.publicView(owner, revision, "vi-VN")).thenReturn(view);
        assertThat(queries.published("VN", "vi-VN", 0, 20, season, null, true).items()).containsExactly(view);
        verify(contexts, never()).resolve(anyString(), any());
    }

    private EnchantmentIdentity owner(String code) {
        var owner = new EnchantmentIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        return owner;
    }

    private EnchantmentRevision revision(EnchantmentIdentity owner, long number) {
        var revision = new EnchantmentRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(rulesetId);
        revision.setRevisionNo(number);
        revision.setState("DRAFT");
        revision.setCause("DATA_BASELINE");
        return revision;
    }

    private EnchantmentTranslation translation(EnchantmentRevision revision, String locale, String name) {
        var translation = new EnchantmentTranslation();
        translation.setRevisionId(revision.getId());
        translation.setLocale(locale);
        translation.setName(name);
        return translation;
    }
}
