package com.wikiaov.media.internal.infrastructure;

import com.wikiaov.media.internal.application.MediaProperties;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MediaProperties.class)
class MediaConfiguration {
}
