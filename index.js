const { ApolloServer, PubSub } = require("apollo-server-express");
const express = require("express");
const expressPlayground = require("graphql-playground-middleware-express")
  .default;
const { readFileSync } = require("fs");
const typeDefs = readFileSync("./typeDefs.graphql", "UTF-8");
const resolvers = require("./resolvers");
const { createServer } = require("http");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const pubsub = new PubSub();

async function start() {
  const app = express();
  const MONGO_DB = process.env.DB_HOST;

  const client = await MongoClient.connect(MONGO_DB, { useNewUrlParser: true });
  const db = client.db();

  const context = { db, pubsub };

  const server = new ApolloServer({ typeDefs, resolvers, context });
  server.applyMiddleware({ app });

  app.get("/", (req, res) => res.end("Welcome to the PhotoShare API"));

  app.get("/playground", expressPlayground({ endpoint: "/graphql" }));

  const httpServer = createServer(app);

  server.installSubscriptionHandlers(httpServer);

  httpServer.listen({ port: 3000 }, () =>
    console.log(`GraphQL Server running at localhost:3000${server.graphqlPath}`)
  );
}

start();
