package com.wikiaov.platform;

import java.util.List;
import java.util.function.Function;

/**
 * Framework-neutral page of results; Spring's {@code Page} is never exposed to clients.
 * {@code totalPages = ceil(totalElements / size)}, and 0 when there are no elements.
 */
public record PageSlice<T>(List<T> items, int page, int size, long totalElements) {

    public PageSlice {
        items = List.copyOf(items);
    }

    public int totalPages() {
        return totalElements == 0 ? 0 : (int) ((totalElements + size - 1) / size);
    }

    public <R> PageSlice<R> map(Function<? super T, ? extends R> mapper) {
        return new PageSlice<>(items.stream().<R>map(mapper).toList(), page, size, totalElements);
    }
}
