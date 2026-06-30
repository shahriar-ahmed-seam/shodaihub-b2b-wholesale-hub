# Inventory Service (Java 21 + Spring Boot 3)

The transactional core of B2B-Wholesale-Hub. Implemented across Milestones 4–6.

## Toolchain

- **Language/runtime target:** Java 21 (LTS), enforced via the Gradle Java toolchain in
  `build.gradle`. Java 24 is installed on this machine and is backward compatible; the toolchain
  pins compilation/bytecode to 21 so builds are reproducible against the design's fixed version.
- **Build tool:** Gradle (Groovy DSL).
- **Formatting/linting:** [Spotless](https://github.com/diffplug/spotless) with
  `google-java-format`. Run `gradle spotlessApply` to format and `gradle spotlessCheck` in CI.
- **Property-based testing:** [jqwik](https://jqwik.net/) (min 100 iterations) +
  Testcontainers for Postgres/Redis.

## Generating the Gradle wrapper

This scaffold ships `gradle/wrapper/gradle-wrapper.properties` but not the binary
`gradle-wrapper.jar` (binaries are not committed by the scaffolding step). Generate the full
wrapper once with a locally installed Gradle:

```bash
cd services/inventory
gradle wrapper --gradle-version 8.10.2
```

After that, use `./gradlew build` (or `gradlew.bat build` on Windows).

## Money handling

All monetary values are BDT, stored as `NUMERIC(12,2)` and computed with `BigDecimal` +
`RoundingMode.HALF_UP`. No floating-point money anywhere.
