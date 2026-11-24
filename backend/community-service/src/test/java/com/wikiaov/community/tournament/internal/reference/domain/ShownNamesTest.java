package com.wikiaov.community.tournament.internal.reference.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ShownNamesTest {
    @Test
    void otherNamesStandOnceWithoutBlanksAndTheNamesAlreadyShown() {
        var others = ShownNames.others(Arrays.asList("Box Gaming", " box ", "box", "", null, "BOX"), "Box Gaming",
                "BOX");

        assertThat(others).containsExactly("box");
    }

    @Test
    void aNameDrawnFromThePlayersRealNameIsLeftOutWithOrWithoutItsAccents() {
        var others = ShownNames.othersOfPlayer(List.of("Xuân Bách", "xuan bach", "Bách", "XBach"), "XB",
                "Nguyễn Xuân Bách");

        assertThat(others).containsExactly("XBach");
    }

    @Test
    void aNameThatOnlySharesAWordWithTheRealNameIsKept() {
        var others = ShownNames.othersOfPlayer(List.of("Bách Gaming", "Đạt"), "XB", "Nguyễn Xuân Bách");

        assertThat(others).containsExactly("Bách Gaming", "Đạt");
    }

    @Test
    void everyOtherNameIsKeptWhileTheRealNameIsNotKnown() {
        assertThat(ShownNames.othersOfPlayer(List.of("Balzz"), "Bal", null)).containsExactly("Balzz");
    }
}
