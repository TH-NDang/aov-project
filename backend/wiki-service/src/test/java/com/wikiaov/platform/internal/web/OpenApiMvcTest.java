package com.wikiaov.platform.internal.web;

import static org.mockito.Mockito.mock;

import java.util.ArrayList;
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
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.ImportSelector;
import org.springframework.context.annotation.Profile;
import org.springframework.core.type.AnnotationMetadata;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.web.bind.annotation.RestController;

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
                    Set<Class<?>> dependencies = new HashSet<>();
                    var scanner = new ClassPathScanningCandidateComponentProvider(false);
                    scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
                    var controllers = new ArrayList<String>();
                    for (var candidate : scanner.findCandidateComponents("com.wikiaov")) {
                        // Test probes are not part of the production contract.
                        boolean production = !String.valueOf(candidate.getResourceDescription())
                                .contains("test-classes");
                        if (production
                                && !candidate.getBeanClassName().equals(ProblemErrorController.class.getName())) {
                            controllers.add(candidate.getBeanClassName());
                        }
                    }
                    for (String controllerName : controllers) {
                        Class<?> controller = Class.forName(controllerName);
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
