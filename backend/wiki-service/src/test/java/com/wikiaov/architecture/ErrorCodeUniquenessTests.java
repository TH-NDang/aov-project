package com.wikiaov.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.platform.ApiErrorCode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.util.ClassUtils;

/** Clients branch on {@code code} alone, so no two modules may declare the same error code. */
class ErrorCodeUniquenessTests {

    @Test
    void errorCodesAreUniqueAcrossModules() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AssignableTypeFilter(ApiErrorCode.class));

        List<String> owners = new ArrayList<>();
        for (BeanDefinition candidate : scanner.findCandidateComponents("com.wikiaov")) {
            Class<?> type = ClassUtils.forName(candidate.getBeanClassName(), getClass().getClassLoader());
            if (type.isEnum() && !type.getName().contains("Test")) {
                for (Object constant : type.getEnumConstants()) {
                    owners.add(((ApiErrorCode) constant).name() + " <- " + type.getSimpleName());
                }
            }
        }

        Map<String, List<String>> byCode = owners.stream()
                .collect(Collectors.groupingBy(owner -> owner.substring(0, owner.indexOf(' '))));
        assertThat(byCode.values()).as("duplicate error codes").allMatch(list -> list.size() == 1);
        assertThat(byCode).containsKeys("INTERNAL_ERROR", "STORAGE_UNAVAILABLE");
    }
}
