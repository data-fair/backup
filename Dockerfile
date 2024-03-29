######################################
# Stage: nodejs dependencies and build
FROM node:16.20.2-alpine3.18 AS builder

WORKDIR /webapp
ADD package.json .
ADD package-lock.json .
# use clean-modules on the same line as npm ci to be lighter in the cache
RUN npm ci && \
    ./node_modules/.bin/clean-modules --yes --exclude exceljs/lib/doc/ --exclude mocha/lib/test.js --exclude "**/*.mustache"

# Adding UI files
ADD public public
ADD nuxt.config.js .
ADD config config

# Build UI
ENV NODE_ENV production
RUN npm run build && \
    rm -rf dist

# Adding server files
ADD server server
ADD scripts scripts

# Check quality
ADD .gitignore .gitignore
ADD test test
RUN npm run lint

# Cleanup /webapp/node_modules so it can be copied by next stage
RUN npm prune --production && \
    rm -rf node_modules/.cache


##################################
# Stage: main nodejs service stage
FROM node:16.20.2-alpine3.18
MAINTAINER "contact@koumoul.com"

RUN apk add --no-cache mongodb-tools zip unzip bash openssh-client rsync sshpass dumb-init

WORKDIR /webapp

# We could copy /webapp whole, but this is better for layering / efficient cache use
COPY --from=builder /webapp/node_modules /webapp/node_modules
COPY --from=builder /webapp/nuxt-dist /webapp/nuxt-dist
ADD nuxt.config.js nuxt.config.js
ADD server server
ADD scripts scripts
ADD config config

# Adding licence, manifests, etc.
ADD package.json .
ADD README.md BUILD.json* ./
ADD LICENSE .
ADD nodemon.json .

# configure node webapp environment
ENV NODE_ENV production
ENV DEBUG db
# the following line would be a good practice
# unfortunately it is a problem to activate now that the service was already deployed
# with volumes belonging to root
#USER node
VOLUME /webapp/data
EXPOSE 8080

CMD ["dumb-init", "node", "--max-http-header-size", "64000", "server"]
