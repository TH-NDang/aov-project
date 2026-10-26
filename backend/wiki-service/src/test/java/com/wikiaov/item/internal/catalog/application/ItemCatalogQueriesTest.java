package com.wikiaov.item.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemTranslationRepository;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemTranslation;
import com.wikiaov.item.internal.change.persistence.ItemPatchChangeRepository;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class ItemCatalogQueriesTest {
    private final ItemPatchChangeRepository patchChanges = mock(ItemPatchChangeRepository.class);
    private final ItemIdentityRepository identities = mock(ItemIdentityRepository.class);
    private final ItemRevisionRepository revisions = mock(ItemRevisionRepository.class);
    private final ItemTranslationRepository translations = mock(ItemTranslationRepository.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final ItemRevisionContent content = mock(ItemRevisionContent.class);
    private final ItemContentRules rules = mock(ItemContentRules.class);
    private final ItemPublicMedia publicMedia = mock(ItemPublicMedia.class);
    private final ItemCatalogQueries queries = new ItemCatalogQueries(patchChanges, identities, revisions, translations,
            contexts, Clock.systemUTC(), content, rules, publicMedia);
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
        when(content.hydrate(any(), any())).thenReturn(mock(ItemContent.class));

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
    void hydratesOnlyTheRequestedPublishedPage() {
        var first = owner("alpha");
        var second = owner("beta");
        var firstRevision = revision(first, 1);
        var secondRevision = revision(second, 1);
        firstRevision.setState("PUBLISHED");
        secondRevision.setState("PUBLISHED");
        var context = mock(GameplayContext.class);
        when(context.rulesetId()).thenReturn(rulesetId);
        when(contexts.resolve(eq("VN"), any())).thenReturn(context);
        when(identities.findAll(Sort.by("code"))).thenReturn(List.of(first, second));
        when(revisions.findByOwnerIdOrderByRevisionNoDesc(first.getId())).thenReturn(List.of(firstRevision));
        when(revisions.findByOwnerIdOrderByRevisionNoDesc(second.getId())).thenReturn(List.of(secondRevision));
        var firstView = new ItemView(first.getId(), "alpha", null, null, List.of());
        var secondView = new ItemView(second.getId(), "beta", null, null, List.of());
        when(content.publicView(first, firstRevision, "vi-VN")).thenReturn(firstView);
        when(content.publicView(second, secondRevision, "vi-VN")).thenReturn(secondView);
        when(publicMedia.hydrate(List.of(secondView))).thenReturn(List.of(secondView));

        var result = queries.published("VN", "vi-VN", 1, 1);

        assertThat(result.totalElements()).isEqualTo(2);
        assertThat(result.items()).containsExactly(secondView);
        verify(publicMedia).hydrate(List.of(secondView));
        verifyNoMoreInteractions(publicMedia);
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

        var view = new ItemView(owner.getId(), owner.getCode(), null, null, List.of());
        when(content.publicView(owner, revision, "vi-VN")).thenReturn(view);
        assertThat(queries.published("VN", "vi-VN", 0, 20, season, null, true).items()).containsExactly(view);
        verify(contexts, never()).resolve(anyString(), any());
    }

    private ItemIdentity owner(String code) {
        var owner = new ItemIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        return owner;
    }

    private ItemRevision revision(ItemIdentity owner, long number) {
        var revision = new ItemRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(rulesetId);
        revision.setRevisionNo(number);
        revision.setState("DRAFT");
        revision.setCause("DATA_BASELINE");
        return revision;
    }

    private ItemTranslation translation(ItemRevision revision, String locale, String name) {
        var translation = new ItemTranslation();
        translation.setRevisionId(revision.getId());
        translation.setLocale(locale);
        translation.setName(name);
        return translation;
    }
}
