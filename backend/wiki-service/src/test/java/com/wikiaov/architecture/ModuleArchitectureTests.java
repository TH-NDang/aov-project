package com.wikiaov.architecture;

import com.wikiaov.WikiAovApplication;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModuleArchitectureTests {
    @Test
    void modulesRespectBoundaries() {
        ApplicationModules.of(WikiAovApplication.class).verify();
    }
}

