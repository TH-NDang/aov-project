package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class PageSliceTest {
    private static final List<String> ALL = List.of("a", "b", "c", "d", "e");

    @Test
    void aPageOfAFilteredListKeepsTheTotalOfTheWholeList() {
        var slice = PageSlice.of(ALL, 1, 2);

        assertThat(slice.items()).containsExactly("c", "d");
        assertThat(slice.totalElements()).isEqualTo(5);
    }

    @Test
    void theLastPageHoldsWhatIsLeft() {
        assertThat(PageSlice.of(ALL, 2, 2).items()).containsExactly("e");
    }

    @Test
    void aPageFarPastTheEndIsEmptyInsteadOfOverflowing() {
        var slice = PageSlice.of(ALL, Integer.MAX_VALUE, 100);

        assertThat(slice.items()).isEmpty();
        assertThat(slice.page()).isEqualTo(Integer.MAX_VALUE);
        assertThat(slice.totalElements()).isEqualTo(5);
    }
}
