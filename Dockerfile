FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["npx", "tsx", "src/server.ts"]
