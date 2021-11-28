FROM node:14-alpine
WORKDIR /usr/src/services/explore
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
EXPOSE 5007
CMD ["node", "./main.js", "&"]
