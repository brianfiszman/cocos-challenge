FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source, scripts, and config
COPY . .
RUN yarn build

# Make the entrypoint executable
RUN chmod +x scripts/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
