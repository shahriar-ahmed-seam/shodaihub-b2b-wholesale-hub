# syntax=docker/dockerfile:1
# ============================================================================
# Inventory Service — multi-stage production image (Java 21 + Spring Boot 3).
#
# Built with services/inventory as the build context (self-contained Gradle project):
#
#     docker build -t b2b/inventory services/inventory
#
# Stage 1 builds the executable boot jar with the Gradle wrapper (pinned to the
# Java 21 toolchain). Stage 2 runs it on a slim JRE 21 as a non-root user.
# ============================================================================

# ----------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
# Wrapper + build scripts first for dependency-layer caching.
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --version
# Warm the dependency cache (kept in its own layer; tolerant of no-op).
RUN ./gradlew dependencies --no-daemon > /dev/null 2>&1 || true
# Source, then build the boot jar (skip tests — they need testcontainers/Docker; CI runs them).
COPY src src
RUN ./gradlew bootJar --no-daemon -x test \
 && cp build/libs/inventory-*.jar /app/app.jar

# ----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
ENV INVENTORY_PORT=8081 \
    JAVA_OPTS=""
# Run as the built-in unprivileged user shipped in the temurin image.
RUN useradd -r -u 1001 -m -d /home/appuser appuser
COPY --from=build /app/app.jar /app/app.jar
USER appuser
EXPOSE 8081
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
