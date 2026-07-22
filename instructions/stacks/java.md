# Java / Kotlin (JVM) — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for JVM projects. The repo's `CLAUDE.md`, `pom.xml`, or Gradle build win over this.

## Detect
`pom.xml` (Maven) or `build.gradle[.kts]` (Gradle). Tests: JUnit 5 / JUnit 4 / TestNG. Use the wrapper if present (`./mvnw`, `./gradlew`).

## Commands
- Build: `./mvnw -q verify -DskipTests` or `./gradlew build -x test`.
- Lint/format: Checkstyle / Spotless (`spotless:check` / `spotlessCheck`) if configured.
- Unit tests: `./mvnw test` or `./gradlew test`.
- Tests with coverage (JaCoCo):
  - Maven: `./mvnw test` with the JaCoCo plugin (`prepare-agent` + `report`) → `target/site/jacoco/jacoco.xml`
  - Gradle: `./gradlew test jacocoTestReport` → `build/reports/jacoco/test/jacocoTestReport.xml`

## Coverage
- Report: **JaCoCo XML** (paths above) — parse per-class line/branch counters. Enable the XML reporter if only HTML is generated.
- Multi-module: Gradle `jacoco-report-aggregation` plugin, or Maven `jacoco:report-aggregate`, for one merged XML.
- Kotlin projects often use **Kover** (`./gradlew koverXmlReport` → `build/reports/kover/report.xml`).
- Gate: `jacocoTestCoverageVerification` (Gradle) / `jacoco:check` (Maven).

## E2E
- Selenium WebDriver or Playwright for Java; Rest-Assured for API flows.

## Conventions & gotchas
- Tests under `src/test/java`, mirroring the class's package.
- Prefer constructor injection + in-memory collaborators over deep mocking.

## Docs
JaCoCo (Gradle): <https://docs.gradle.org/current/userguide/jacoco_plugin.html> · Kover: <https://github.com/Kotlin/kotlinx-kover>
