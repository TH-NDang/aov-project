package com.wikiaov.community.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import tools.jackson.databind.json.JsonMapper;

class PageSliceTest {
    @Test
    void aSpringPageBecomesASliceWithItsPositionAndTotal() {
        var slice = PageSlice.from(new PageImpl<>(List.of("b"), PageRequest.of(1, 1), 3));

        assertThat(slice).isEqualTo(new PageSlice<>(List.of("b"), 1, 1, 3));
    }

    @Test
    void theSliceCountsThePagesOfTheWholeList() {
        assertThat(new PageSlice<>(List.of("a", "b"), 0, 2, 5).totalPages()).isEqualTo(3);
    }

    @Test
    void anEmptyListHasNoPages() {
        assertThat(new PageSlice<>(List.of(), 0, 20, 0).totalPages()).isZero();
    }

    @Test
    void aSliceIsWrittenWithTheFieldsClientsRead() {
        var json = JsonMapper.builder().build().valueToTree(new PageSlice<>(List.of("a"), 0, 20, 1));

        assertThat(json.propertyNames()).containsExactlyInAnyOrder("items", "page", "size", "totalElements");
    }
}
