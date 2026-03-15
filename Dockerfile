# Node LTS
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Use refactored server as in package.json start script
CMD ["npm", "start"]



