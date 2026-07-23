FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

# Copy the maven wrapper and pom.xml files
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Grant execution permission to the maven wrapper (Fixes the permission denied error)
RUN chmod +x mvnw

# Download dependencies
RUN ./mvnw dependency:go-offline

# Copy the rest of your source code
COPY src ./src

# Build the application
RUN ./mvnw clean package -DskipTests

# Specify the command to run your application
CMD ["java", "-jar", "target/api-0.0.1-SNAPSHOT.jar"]