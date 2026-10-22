package com.wikiaov.platform.internal.web;

import static org.mockito.Mockito.mock;

import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import org.springdoc.core.configuration.SpringDocConfiguration;
import org.springdoc.core.configuration.SpringDocSpecPropertiesConfiguration;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.webmvc.core.configuration.MultipleOpenApiSupportConfiguration;
import org.springdoc.webmvc.core.configuration.SpringDocWebMvcConfiguration;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.ImportSelector;
import org.springframework.context.annotation.Profile;
import org.springframework.core.type.AnnotationMetadata;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import tools.jackson.databind.json.JsonMapper;

@WebMvcTest
@ActiveProfiles({"test", "openapi-contract-slice"})
@ContextConfiguration(classes = OpenApiMvcTest.WebOnlyApplication.class)
@ImportAutoConfiguration({SpringDocConfiguration.class, SpringDocConfigProperties.class,
        SpringDocSpecPropertiesConfiguration.class,
        SpringDocWebMvcConfiguration.class, MultipleOpenApiSupportConfiguration.class})
class OpenApiMvcTest extends OpenApiContractChecks {
    @Configuration(proxyBeanMethods = false)
    @Profile("openapi-contract-slice")
    @Import({ApiVersioningConfiguration.class, OpenApiConfiguration.class, WebMvcConfiguration.class,
            ProblemDetailsExceptionHandler.class, RequestIdFilter.class, RealSecurity.class})
    static class WebOnlyApplication {
        @Bean
        JwtDecoder jwtDecoder() {
            return mock(JwtDecoder.class);
        }

        @Bean
        static BeanFactoryPostProcessor applicationControllersWithMockedUseCases() {
            return beanFactory -> {
                var registry = (DefaultListableBeanFactory) beanFactory;
                try {
                    var baseline = JsonMapper.builder().build().readTree(
                            Path.of("src/test/resources/contracts/controller-baseline.json").toFile());
                    Set<Class<?>> dependencies = new HashSet<>();
                    for (var entry : baseline.properties()) {
                        Class<?> controller = Class.forName(entry.getKey().replace('/', '.').replace(".java", ""));
                        registry.registerBeanDefinition(controller.getName(), new RootBeanDefinition(controller));
                        for (var constructor : controller.getDeclaredConstructors()) {
                            for (Class<?> dependency : constructor.getParameterTypes()) {
                                if (dependency.getName().startsWith("com.wikiaov.")) {
                                    dependencies.add(dependency);
                                }
                            }
                        }
                    }
                    for (Class<?> type : dependencies) {
                        boolean suppliedByConcreteUseCase = type.isInterface() && dependencies.stream()
                                .anyMatch(candidate -> !candidate.isInterface() && type.isAssignableFrom(candidate));
                        if (!suppliedByConcreteUseCase) {
                            registry.registerSingleton(type.getName(), mock(type));
                        }
                    }
                } catch (Exception exception) {
                    throw new IllegalStateException("Cannot assemble the production HTTP contract inventory",
                            exception);
                }
            };
        }
    }

    static class RealSecurity implements ImportSelector {
        @Override
        public String[] selectImports(AnnotationMetadata metadata) {
            return new String[] {
                    "com.wikiaov.access.internal.infrastructure.SecurityConfiguration",
                    "com.wikiaov.access.internal.infrastructure.ProblemAuthenticationEntryPoint",
                    "com.wikiaov.access.internal.infrastructure.ProblemAccessDeniedHandler",
                    "com.wikiaov.access.internal.infrastructure.ProblemResponseWriter"
            };
        }
    }
}
