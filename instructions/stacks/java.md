# Java (JVM) — stack profile

Baseline for Java/Kotlin JVM projects. The repo's `CLAUDE.md`, `pom.xml`, or Gradle build win over this.

## Detect
`pom.xml` (Maven) or `build.gradle` / `build.gradle.kts` (Gradle). Tests: JUnit 5 / JUnit 4 / TestNG.

## Commands
- Build: `mvn -q verify -DskipTests` or `./gradlew build -x test`.
- Lint/format: Checkstyle / Spotless (`mvn spotless:check` or `./gradlew spotlessCheck`) if configured.
- Unit tests: `mvn test` or `./gradlew test`.
- Tests with coverage (JaCoCo):
  - Maven: `mvn test` with the JaCoCo plugin → `target/site/jacoco/jacoco.xml`
  - Gradle: `./gradlew test jacocoTestReport` → `build/reports/jacoco/test/jacocoTestReport.xml`

## Coverage
- Report: JaCoCo XML (paths above). Parse per-class/line/branch counters. Enable the XML reporter if only HTML is produced.
- Kotlin projects may use Kover (`./gradlew koverXmlReport` → `build/reports/kover/report.xml`).

## E2E
- Selenium.WebDriver or Playwright for Java; Rest-Assured for API flows.

## Conventions & gotchas
- Tests under `src/test/java`, mirror the package of the class under test.
- Prefer constructor injection + real in-memory collaborators over deep mocking.
- Gradle vs Maven: detect from the build file present and use its wrapper (`./gradlew`, `./mvnw`) when available.
