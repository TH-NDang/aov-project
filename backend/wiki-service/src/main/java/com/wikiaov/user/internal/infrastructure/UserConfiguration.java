package com.wikiaov.user.internal.infrastructure;

import com.wikiaov.user.internal.application.ProfileDefaults;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ProfileDefaults.class)
class UserConfiguration {
}
