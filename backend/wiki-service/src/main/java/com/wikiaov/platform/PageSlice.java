package com.wikiaov.platform;

import java.util.List;
import java.util.function.Function;

/**
 * Framework-neutral page of results; Spring's {@code Page} is never exposed to clients.
 * {@code totalPages = ceil(totalElements / size)}, and 0 when there are no elements.
 */
public record PageSlice<T>(
        List<T> items,
        int page,
        int size,
        long totalElements
) {

    public PageSlice {
        items = List.copyOf(items);
    }

    public int totalPages() {
        return totalElements == 0 ? 0 : (int) ((totalElements + size - 1) / size);
    }

    public <R> PageSlice<R> map(Function<? super T, ? extends R> mapper) {
        return new PageSlice<>(items.stream().<R>map(mapper).toList(), page, size, totalElements);
    }

    /** The same page with its items replaced, for items read or hydrated in one batch. */
    public <R> PageSlice<R> withItems(List<R> replaced) {
        return new PageSlice<>(replaced, page, size, totalElements);
    }

    /**
     * One page of a list already filtered and sorted in memory. The offset is computed in {@code long}, so a page far
     * past the end is simply empty.
     */
    public static <T> PageSlice<T> of(List<T> all, int page, int size) {
        int from = (int) Math.min((long) page * size, all.size());
        int to = (int) Math.min((long) from + size, all.size());
        return new PageSlice<>(all.subList(from, to), page, size, all.size());
    }
}
