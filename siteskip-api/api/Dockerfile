# Use an official OpenJDK image to run Java 17 (or your current Java version)
FROM eclipse-temurin:17-jdk-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the maven wrapper and pom.xml files first to cache dependencies
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Download dependencies (this makes building faster)
RUN ./mvnw dependency:go-offline

# Copy the rest of your source code
COPY src ./src

# Build the application
RUN ./mvnw clean package -DskipTests

# Specify the command to run your application when the container starts
CMD ["java", "-jar", "target/api-0.0.1-SNAPSHOT.jar"]