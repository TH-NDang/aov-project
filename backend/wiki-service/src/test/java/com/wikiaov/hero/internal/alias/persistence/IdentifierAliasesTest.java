package com.wikiaov.hero.internal.alias.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.alias.persistence.entity.ImageFileAlias;
import com.wikiaov.hero.internal.badges.persistence.SkinBadgeRepository;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class IdentifierAliasesTest {
    private final IdentifierAliasRepository aliases = mock(IdentifierAliasRepository.class);
    private final IdentifierNamespaceRepository namespaces = mock(IdentifierNamespaceRepository.class);
    private final SkinBadgeRepository badges = mock(SkinBadgeRepository.class);
    private final IdentifierAliases identifiers = new IdentifierAliases(aliases, namespaces, badges);

    @Test
    void badgeSequenceLocksTheNamespaceBeforeReadingCodesAndFillsTheFirstGap() {
        when(badges.codes()).thenReturn(List.of("bac-ss-vn-1", "bac-ss-vn-3"));

        assertThat(identifiers.nextBadgeCode("Bậc SS", "vn")).isEqualTo("bac-ss-vn-2");

        var order = inOrder(namespaces, badges);
        order.verify(namespaces).lock("skin-badge");
        order.verify(badges).codes();
        order.verifyNoMoreInteractions();
    }

    @Test
    void migratedImageNamesReplaceOnlyMissingOrLegacyLabels() {
        var asset = UUID.randomUUID();
        var alias = mock(ImageFileAlias.class);
        when(alias.getAssetId()).thenReturn(asset);
        when(alias.getLegacyName()).thenReturn("old-file.jpg");
        when(alias.getFileName()).thenReturn("airi-1.jpg");
        when(aliases.images(List.of(asset))).thenReturn(List.of(alias));

        for (String label : Arrays.asList(null, "old-file.jpg", "Editorial crop")) {
            var incoming = new Bindings(Map.of(), List.of(),
                    Map.of(MediaRole.HEAD, List.of(new ImageOption(asset, label))));

            var resolved = identifiers.bindings(incoming);

            assertThat(resolved.images().get(MediaRole.HEAD).getFirst().label())
                    .isEqualTo("Editorial crop".equals(label) ? label : "airi-1.jpg");
        }
    }

    @Test
    void emptyImageSetsDoNotQueryAliases() {
        var incoming = new Bindings(Map.of(), List.of());

        assertThat(identifiers.bindings(incoming)).isEqualTo(incoming);

        verifyNoInteractions(aliases, namespaces, badges);
    }
}
