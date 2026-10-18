package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.access.*;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

class AcceptedCommandsTest {
    @Test
    void limitsCapabilitiesAndRestoresContextAfterFailure() {
        var original = SecurityContextHolder.createEmptyContext();
        SecurityContextHolder.setContext(original);
        try {
            var owner = new Actor("issuer", "editor", ActorType.HUMAN, "Editor", Set.of("hero:publish"));
            assertThatThrownBy(() -> new RunAcceptedCommands().runHeroImport(owner, () -> {
                var actor = new SecurityContextCurrentActor().require();
                assertThat(actor.subject()).isEqualTo("editor");
                assertThat(actor.capabilities()).containsExactlyInAnyOrder("hero:write", "catalog:read");
                throw new IllegalStateException("Rollback");
            })).isInstanceOf(IllegalStateException.class);
            assertThat(SecurityContextHolder.getContext()).isSameAs(original);
            assertThat(new SecurityContextCurrentActor().find()).isEmpty();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
