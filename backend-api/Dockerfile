# Etapa 1: Compilación del proyecto Java con Maven
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

# Etapa 2: Imagen de ejecución liviana
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/banco-acid-api-1.0.0.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
