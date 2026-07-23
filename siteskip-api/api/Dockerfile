# Use Java 21 to match your project configuration
FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app

# Copy the maven wrapper and pom.xml files
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Grant execution permission to the maven wrapper
RUN chmod +x mvnw

# Download dependencies
RUN ./mvnw dependency:go-offline

# Copy the rest of your source code
COPY src ./src

# Build the application
RUN ./mvnw clean package -DskipTests

# Specify the command to run your application
CMD ["java", "-jar", "target/api-0.0.1-SNAPSHOT.jar"]