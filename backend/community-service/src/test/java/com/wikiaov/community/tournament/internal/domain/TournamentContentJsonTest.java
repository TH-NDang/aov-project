package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TournamentContentJsonTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void omittedFlagsReadAsFalseInsteadOfRejectingTheRequest() {
        var game = json.readValue("{\"number\":1,\"sides\":[]}", TournamentContent.Game.class);
        var allocation = json.readValue("{\"tier\":1}", TournamentContent.EnchantmentAllocation.class);
        var slot = json.readValue("{\"slot\":1}", TournamentContent.InventorySlot.class);
        var item = json.readValue("{\"code\":\"blade\"}", TournamentContent.Reference.class);
        var step = json.readValue("{\"item\":{\"name\":\"Blade\"}}", TournamentContent.BuildStep.class);

        assertThat(item.active()).isFalse();
        assertThat(step.sold()).isFalse();
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

    @Test
    void aParticipantWithoutABuildIsWrittenWithoutTheKeyAndReadBackAsAnEmptyList() {
        var participant = new TournamentContent.Participant(null, null, null, null, null, null, null, null, null);

        var written = json.writeValueAsString(participant);

        assertThat(json.readTree(written).has("build")).isFalse();
        assertThat(json.readValue(written, TournamentContent.Participant.class).build()).isEmpty();
    }

    @Test
    void aStepOfTheFirstListsIsReadAsARoleAndASaleAndWrittenWithoutItsPlace() {
        var participant = json.readValue("""
                {"build":[{"item":{"name":"Spear"},"place":"REPLACED"},{"item":{"name":"Boots"},"place":"REPLACED"},
                {"item":{"name":"Lance"},"from":[{"name":"spear"}],"place":"KEPT"},
                {"item":{"name":"Revive"},"place":"SITUATIONAL"}]}""", TournamentContent.Participant.class);

        assertThat(participant.build()).extracting(step -> step.item().name(), TournamentContent.BuildStep::role,
                TournamentContent.BuildStep::sold, TournamentContent.BuildStep::place).containsExactly(
                        tuple("Spear", TournamentContent.BuildRole.CORE, false, null),
                        tuple("Boots", TournamentContent.BuildRole.CORE, true, null),
                        tuple("Lance", TournamentContent.BuildRole.CORE, false, null),
                        tuple("Revive", TournamentContent.BuildRole.PROTECTIVE, false, null));
        assertThat(json.writeValueAsString(participant)).doesNotContain("place");
    }

    @Test
    void aStepIsWrittenWithoutTheSalesItDidNotMakeNorASaleThatDidNotHappen() {
        var step = new TournamentContent.BuildStep(new TournamentContent.Selection(null, "Boots"), null, null, null,
                false, null);

        var written = json.readTree(json.writeValueAsString(step));

        assertThat(written.has("replaces")).isFalse();
        assertThat(written.has("sold")).isFalse();
        assertThat(written.path("role").asString()).isEqualTo("CORE");
        assertThat(written.path("from").isArray()).isTrue();
    }
}
