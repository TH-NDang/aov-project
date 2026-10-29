package com.wikiaov.community;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModuleArchitectureTest {
    @Test
    void modulesKeepPersistencePrivate() {
        ApplicationModules.of(CommunityApplication.class).verify();
    }
}
