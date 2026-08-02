FROM node:24.18.0-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node . .

USER node
EXPOSE 3215

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3215/healthz').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/http.js"]
