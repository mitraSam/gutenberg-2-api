const { ApolloServer, PubSub } = require("apollo-server-express");
const express = require("express");
const expressPlayground = require("graphql-playground-middleware-express")
  .default;
const { readFileSync } = require("fs");
const typeDefs = readFileSync("./typeDefs.graphql", "UTF-8");
const resolvers = require("./resolvers");
const { createServer } = require("http");
const { MongoClient } = require("mongodb");
const { verifyToken } = require("./lib");
const FormatError = require("easygraphql-format-error");
const cors = require("cors");
const formatError = new FormatError([
  {
    name: "INVALID_CREDENTIALS",
    message: "username || pwd is invalid",
    statusCode: 400
  }
]);
const errorName = formatError.errorName;

require("dotenv").config();
const pubsub = new PubSub();

async function start() {
  const app = express();
  app.use(cors());
  const MONGO_DB = process.env.DB_HOST;

  const client = await MongoClient.connect(MONGO_DB, { useNewUrlParser: true });
  const db = client.db();

  const context = async ({ req, connection }) => {
    const token = req
      ? req.headers.authorization
      : connection.context.Authorization;
    const currentUser = verifyToken(token);

    return { db, currentUser, pubsub, errorName };
  };

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    formatError: err => {
      return formatError.getError(err);
    }
  });
  server.applyMiddleware({ app });

  app.get("/", (req, res) => res.end("Welcome to the  'gutenberg's den'  API"));

  app.get("/playground", expressPlayground({ endpoint: "/graphql" }));

  const httpServer = createServer(app);

  server.installSubscriptionHandlers(httpServer);

  httpServer.listen({ port: 3000 }, () =>
    console.log(`GraphQL Server running at localhost:3000${server.graphqlPath}`)
  );
}

start();
