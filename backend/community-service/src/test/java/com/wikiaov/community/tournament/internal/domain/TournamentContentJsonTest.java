package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TournamentContentJsonTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void omittedFlagsReadAsFalseInsteadOfRejectingTheRequest() {
        var game = json.readValue("{\"number\":1,\"sides\":[]}", TournamentContent.Game.class);
        var allocation = json.readValue("{\"tier\":1}", TournamentContent.EnchantmentAllocation.class);
        var slot = json.readValue("{\"slot\":1}", TournamentContent.InventorySlot.class);

        assertThat(game.includeUnscoped()).isFalse();
        assertThat(allocation.primary()).isFalse();
        assertThat(slot.known()).isFalse();
    }

    @Test
    void explicitFlagsAreKept() {
        var game = json.readValue("{\"includeUnscoped\":true}", TournamentContent.Game.class);
        var allocation = json.readValue("{\"primary\":true}", TournamentContent.EnchantmentAllocation.class);
        var slot = json.readValue("{\"known\":true}", TournamentContent.InventorySlot.class);

        assertThat(game.includeUnscoped()).isTrue();
        assertThat(allocation.primary()).isTrue();
        assertThat(slot.known()).isTrue();
    }
}
