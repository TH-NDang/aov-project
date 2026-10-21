package com.wikiaov.item.internal.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.access.*;
import com.wikiaov.item.internal.application.ItemCommands;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.*;
import com.wikiaov.item.internal.persistence.entity.*;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ItemCatalogWorkflowTest {
    private final ItemIdentityRepository identities = mock(ItemIdentityRepository.class);
    private final ItemRevisionRepository revisions = mock(ItemRevisionRepository.class);
    private final ItemRecipeLockRepository recipeLock = mock(ItemRecipeLockRepository.class);
    private final ItemCatalogQueries queries = mock(ItemCatalogQueries.class);
    private final ItemRevisionContent content = mock(ItemRevisionContent.class);
    private final ItemContentRules rules = mock(ItemContentRules.class);
    private final ItemCatalog catalog = new ItemCatalog(mock(PatchDataReviews.class), identities, revisions,
            mock(GameplayContexts.class), mock(CurrentActor.class), mock(AuditLog.class), Clock.systemUTC(),
            recipeLock, queries, content, rules);

    @Test
    void locksRecipeGraphBeforeIdentityAndChecksVersionBeforeContentValidation() {
        UUID id = UUID.randomUUID();
        UUID revisionId = UUID.randomUUID();
        var owner = new ItemIdentity();
        owner.setId(id);
        var revision = new ItemRevision();
        revision.setId(revisionId);
        revision.setOwnerId(id);
        revision.setState("DRAFT");
        revision.setVersion(2);
        when(recipeLock.lockGraph()).thenReturn(Optional.of(new ItemRecipeLock()));
        when(identities.lockById(id)).thenReturn(Optional.of(owner));
        when(queries.revision(id, revisionId)).thenReturn(revision);

        assertThatThrownBy(() -> catalog.update(id, revisionId,
                new ItemCommands.Update(1L, mock(ItemContent.class), "note", null)))
                .isInstanceOf(ApiException.class).hasMessage("The draft has changed.");

        var order = inOrder(recipeLock, identities, queries);
        order.verify(recipeLock).lockGraph();
        order.verify(identities).lockById(id);
        order.verify(queries).revision(id, revisionId);
        verifyNoInteractions(rules, content, revisions);
    }
}
