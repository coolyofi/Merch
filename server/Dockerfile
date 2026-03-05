FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY src ./src

EXPOSE 8787

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
