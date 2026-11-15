package com.wikiaov.gamemode.internal.domain;

import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Collects field errors with stable codes while a content rule walks a document. */
public final class ContentChecks {
    public static final Pattern CODE = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");

    private final List<ApiFieldError> errors = new ArrayList<>();

    public List<ApiFieldError> errors() {
        return List.copyOf(errors);
    }

    public void fail(String path, String code, String message) {
        errors.add(new ApiFieldError(path, code, message));
    }

    public void text(String path, String value, int max, boolean required) {
        if (value == null || value.isBlank()) {
            if (required)
                fail(path, "REQUIRED", "A value is required.");
            return;
        }
        if (value.length() > max)
            fail(path, "TOO_LONG", "At most " + max + " characters are allowed.");
    }

    public void code(String path, String value, Set<String> seen) {
        if (value == null || value.length() > 120 || !CODE.matcher(value).matches()) {
            fail(path, "INVALID_CODE", "Use lowercase letters, digits and single hyphens.");
            return;
        }
        if (!seen.add(value))
            fail(path, "DUPLICATE_CODE", "The code is already used in this list.");
    }

    public void oneOf(String path, String value, Set<String> allowed, boolean required) {
        if (value == null) {
            if (required)
                fail(path, "REQUIRED", "A value is required.");
            return;
        }
        if (!allowed.contains(value))
            fail(path, "INVALID_VALUE", "Allowed values: " + String.join(", ", allowed.stream().sorted().toList()));
    }

    public void range(String path, Integer value, int min, int max, boolean required) {
        if (value == null) {
            if (required)
                fail(path, "REQUIRED", "A value is required.");
            return;
        }
        if (value < min || value > max)
            fail(path, "OUT_OF_RANGE", "Use a value from " + min + " to " + max + ".");
    }

    public void size(String path, Collection<?> values, int max) {
        if (values.size() > max)
            fail(path, "TOO_MANY", "At most " + max + " entries are allowed.");
    }

    public void url(String path, String value) {
        if (value == null || value.isBlank())
            return;
        if (value.length() > 2048 || !(value.startsWith("https://") || value.startsWith("http://")))
            fail(path, "INVALID_URL", "Use an http or https address.");
    }

    /** Checks that every code points at an entry of {@code known} and appears once. */
    public void references(String path, List<String> codes, Set<String> known, int max) {
        size(path, codes, max);
        var seen = new HashSet<String>();
        for (int i = 0; i < codes.size(); i++) {
            String code = codes.get(i);
            if (!known.contains(code))
                fail(path + "[" + i + "]", "UNKNOWN_REFERENCE", "No entry has this code.");
            else if (!seen.add(code))
                fail(path + "[" + i + "]", "DUPLICATE_REFERENCE", "The entry is listed twice.");
        }
    }
}
