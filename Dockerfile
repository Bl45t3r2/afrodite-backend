FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Corriger les permissions avant d'exécuter prisma
RUN chmod +x node_modules/.bin/prisma
RUN node_modules/.bin/prisma generate

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]
