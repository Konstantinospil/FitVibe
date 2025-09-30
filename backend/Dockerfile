FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install && npm cache clean --force
COPY . .

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh","-c","node scripts/wait-for-db.js && npx knex migrate:latest && npx knex seed:run && node server.js"]
