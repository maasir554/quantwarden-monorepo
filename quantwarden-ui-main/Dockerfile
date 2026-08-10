FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Copy package files and prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Prisma detects the available OpenSSL ABI while generating its client during
# npm install, so install the runtime library before npm ci.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci

FROM deps AS db-init
WORKDIR /app

ENV NODE_ENV=production

CMD ["npx", "prisma", "db", "push", "--accept-data-loss"]

FROM deps AS builder
WORKDIR /app

ARG EMAIL_AUTH_ENABLED=false
ENV EMAIL_AUTH_ENABLED=$EMAIL_AUTH_ENABLED

COPY . .

# Generate prisma client
RUN npx prisma generate

# Build the Next.js application.
# Next's "Collecting page data" step imports every route module, and
# src/lib/prisma.ts throws if DATABASE_URL is unset. A dummy URL satisfies
# client construction at build time — no connection is made during the build.
# The real DATABASE_URL is injected at runtime by docker-compose.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV BETTER_AUTH_SECRET="build-only-secret-not-used-at-runtime"
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ARG EMAIL_AUTH_ENABLED=false
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV EMAIL_AUTH_ENABLED=$EMAIL_AUTH_ENABLED
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Prisma Client needs OpenSSL. The reporting API compiles genuine PDFs with
# pdflatex; recommended/font packages provide the table, color, and font stack.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
      texlive-latex-base \
      texlive-latex-recommended \
      texlive-fonts-recommended \
      texlive-pictures \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
