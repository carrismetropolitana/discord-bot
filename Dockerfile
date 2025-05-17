FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Run the app
ENTRYPOINT ["bun", "--bun", "run", "src/index.ts"]
