const { GraphQLScalarType } = require("graphql");
const { streamParser, fetchWiki, generateToken } = require("./lib");
const { hash, compareSync } = require("bcrypt");
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
      db.collection("books").estimatedDocumentCount(),
    async recentBooks(parent, args, { db }) {
      return await db
        .collection("books")
        .find({}, { projection: { title: 1, author: 1 } })
        .sort({ _id: -1 })
        .limit(4)
        .toArray();
    },
    async bookDetails(parent, args, { db }) {
      const bookDetails = await db
        .collection("books")
        .findOne({ title: args.title }, { projection: { chapters: 0 } });
      return bookDetails;
    },

    async bookChapter(parent, args, { db }) {
      const bookChapter = await db.collection("books").findOne(
        { title: args.title },
        {
          projection: {
            title: 1,
            author: 1,
            credits: 1,
            url: 1,
            source: 1,
            wikiData: 1,
            license: 1,
            chapterTitles: 1,
            chapters: { $elemMatch: { title: args.chapterTitle } }
          }
        }
      );
      return bookChapter;
    }
  },
  Mutation: {
    async uploadBook(parent, args, { db, pubsub }) {
      const {
        title,
        author,
        license,
        file,
        url,
        source,
        credits,
        epigraph
      } = args.input;

      const { createReadStream } = await file;

      pubsub.publish("uploading-book", {
        uploadingBook: { message: "parsing book" }
      });
      const chapters = await streamParser(createReadStream);
      const chapterTitles = chapters.titles;
      const wikiData = await fetchWiki(title.toLowerCase());
      const book = {
        title,
        author,
        license,
        url,
        source,
        credits,
        chapters,
        wikiData,
        epigraph,
        chapterTitles
      };
      pubsub.publish("uploading-book", {
        uploadingBook: { message: "inserting book into db" }
      });

      const { insertedIds } = await db.collection("books").insertOne(book);
      pubsub.publish("uploading-book", {
        uploadingBook: { message: "book created" }
      });
    },
    async registerUser(parent, args, { db }) {
      const user = { ...args.input };
      user.password = await hash(user.password, 10);
      const {
        ops: [newUser]
      } = await db.collection("users").insertOne(user);

      return generateToken(newUser.username);
    },
    async loginUser(parent, args, { db }) {
      try {
        var user = await db
          .collection("users")
          .findOne({ username: args.username });
        console.log(user);
        const validPwd = compareSync(args.password, user.password);
        console.log(validPwd);
        if (!user || !validPwd) throw "pwd || username invalid";
      } catch (e) {
        throw "pwd || username invalid";
      }
      return generateToken(user.username);
    }
  },

  Subscription: {
    uploadingBook: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator("uploading-book")
    }
  },

  Book: {
    created: parent => parseInt(String(parent.id).substring(0, 8), 16) * 1000
  }
};
