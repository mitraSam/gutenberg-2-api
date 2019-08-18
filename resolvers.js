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
    async recentBooks(parent, args, { db }) {
      return await db
        .collection("details")
        .find({}, { projection: { title: 1, author: 1 } })
        .sort({ _id: 1 })
        .limit(4)
        .toArray();
    },
    async readBooks(parent, args, { db }) {
      const { readBooks } = await db
        .collection("users")
        .findOne({ username: args.username });
      if (readBooks) {
        return Object.keys(readBooks).map(title => ({
          title,
          author: readBooks[title][2],
          chapterNr: readBooks[title][0],
          pageNr: readBooks[title][1]
        }));
      }
      return null;
    },
    async bookDetails(parent, args, { db }) {
      return await db
        .collection("details")
        .findOne({ title: new RegExp(args.title, "i") });
    },

    async bookChapter(parent, args, { db }) {
      /* query the book chapters ids */
      const { chapters } = await db
        .collection("details")
        .findOne(
          { title: new RegExp(args.title, "i") },
          { projection: { chapters: 1 } }
        );

      return await db
        .collection("chapters")
        .findOne({ _id: chapters[args.chapterNr] });
    },
    async search(parent, args, { db }) {
      try {
        return await db
          .collection("details")
          .find(
            { $text: { $search: args.param } },
            { projection: { title: 1, author: 1 } }
          )
          .toArray();
      } catch (e) {
        console.log(e);
      }
    }
  },
  Mutation: {
    async uploadBook(parent, args, { db, pubsub }) {
      const {
        title,
        author,
        license,
        file,
        source,
        credits,
        epigraph
      } = args.input;

      const { createReadStream } = await file;

      const wikiData = await fetchWiki(title.toLowerCase());
      var details = {
        title,
        author,
        license,
        source,
        credits,
        wikiData,
        epigraph
      };

      pubsub.publish("uploading-book", {
        uploadingBook: { message: "parsing book" }
      });

      /* parse HTML file to array of chapters */

      const parsedChapters = await streamParser(createReadStream);
      details.tableOfContents = parsedChapters.map(({ title, pagination }) => ({
        title,
        pagination
      }));
      details.pagesNr = parsedChapters.pagesNr;
      pubsub.publish("uploading-book", {
        uploadingBook: { message: "inserting book into db" }
      });

      /* inserting book details into DB */

      const { insertedId } = await db.collection("details").insertOne(details);

      /* add book details ID to each chapter  */

      const chaptersWithBookId = parsedChapters.map(ch => {
        ch.bookId = insertedId;
        return ch;
      });

      /* insert book chapters  into DB */

      const { insertedIds } = await db
        .collection("chapters")
        .insertMany(chaptersWithBookId);

      /* update book details with chapter IDs  */

      await db
        .collection("details")
        .updateOne({ _id: insertedId }, { $set: { chapters: insertedIds } });

      pubsub.publish("uploading-book", {
        uploadingBook: { message: "book created" }
      });

      return details;
    },
    async registerUser(parent, args, { db }) {
      const user = { password: args.password, username: args.username };
      user.password = await hash(args.password, 10);

      const {
        ops: [newUser]
      } = await db.collection("users").insertOne(user);

      return generateToken(newUser.username);
    },
    bookmarkPage(parent, args, { db }) {
      const { pageNr, chapterNr, title, author } = args;
      const readBook = `readBooks.${title}`;
      db.collection("users").updateOne(
        { username: args.username },
        { $set: { [readBook]: [chapterNr, pageNr, author] } }
      );
    },
    async loginUser(parent, args, { db, currentUser, pubsub, errorName }) {
      try {
        var user = await db
          .collection("users")
          .findOne({ username: args.username });
        const validPwd = compareSync(args.password, user.password);
        if (!user || !validPwd) throw "pwd || username invalid";
      } catch (e) {
        throw new Error(errorName.INVALID_CREDENTIALS);
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
