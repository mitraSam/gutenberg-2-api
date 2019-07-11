const { GraphQLScalarType } = require("graphql");
const { streamParser, fetchWiki } = require("./lib");

module.exports = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "A valid date time value.",
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  }),

  Query: {
    book: (parent, args, { db }) =>
      db.collection("books").findOne({ title: args.title }),
    totalBooks: (parent, args, { db }) =>
      db.collection("books").estimatedDocumentCount()
  },
  Mutation: {
    async uploadBook(parent, args, { db }) {
      const { title, author, license, file, url, source, credits } = args.input;
      const { createReadStream } = await file;
      const chapters = await streamParser(createReadStream);

      const wikiData = await fetchWiki(title);

      const book = {
        title,
        author,
        license,
        url,
        source,
        credits,
        chapters,
        wikiData
      };
      const { insertedIds } = await db.collection("books").insertOne(book);
    }
  },
  Book: {
    created: parent => parseInt(String(parent.id).substring(0, 8), 16) * 1000
  }
};
