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
      const newBook = {
        ...args.input
      };
      const { createReadStream } = await args.input.book;
      const chapters = await streamParser(createReadStream);

      const wikiData = await fetchWiki(args.input.title);
      newBook.wiki = wikiData;

      const { insertedIds } = await db.collection("books").insertOne(newBook);

      newBook.id = insertedIds[0];

      return newBook;
    }
  },
  Book: {
    created: parent => parseInt(String(parent.id).substring(0, 8), 16) * 1000
  }
};
