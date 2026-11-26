# syntax=docker/dockerfile:1
# Production image of community-service. Tests run in CI (`mvnw verify`), not during the image build.

FROM eclipse-temurin:25-jdk-noble AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY config config
COPY src src
RUN --mount=type=cache,id=aov-maven,target=/root/.m2 \
    sh mvnw --batch-mode --no-transfer-progress -DskipTests package
# Layers keep rarely changing dependencies apart from the application classes.
RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination /extracted

FROM eclipse-temurin:25-jre-noble AS runtime
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8082 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
USER app
EXPOSE 8082
# Flyway migrates during startup, so a first start on an empty database takes the longest.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10m --retries=6 \
    CMD curl --fail --silent --output /dev/null "http://127.0.0.1:${SERVER_PORT}/actuator/health" || exit 1
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
