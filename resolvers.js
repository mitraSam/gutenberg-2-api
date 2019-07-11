const { GraphQLScalarType } = require("graphql");
const fetch = require("node-fetch");
const htmlparser = require("htmlparser2");

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
      const stream = await new Promise((res, rej) => {
        createReadStream().pipe(parse(res));
      });
      const wikiData = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${args.input.title}`
      ).then(r => r.json());
      newBook.wiki = wikiData.extract;

      const { insertedIds } = await db.collection("books").insertOne(newBook);

      newBook.id = insertedIds[0];

      return newBook;
    }
  },
  Book: {
    created: parent => parseInt(String(parent.id).substring(0, 8), 16) * 1000
  }
};

function parse(resolver) {
  let isTitle = false;
  let wordCount = 0;
  let pageNr = 0;
  let htmlString = "";
  let book = [];
  let currentChapter;
  function insertPage() {
    currentChapter.pages.push({ content: htmlString, pageNr: ++pageNr });
    htmlString = "";
    wordCount = 0;
  }

  return new htmlparser.Parser(
    {
      onopentag: function(name) {
        if (name === "h2") {
          if (htmlString) insertPage();

          book.push({ pages: [] });
          currentChapter = book[book.length - 1];
          isTitle = true;
        }
        htmlString += `<${name}>`;
      },
      ontext: function(text) {
        wordCount += text.split(" ").length;
        if (isTitle) currentChapter.title = text;
        htmlString += text;
      },
      onclosetag: function(tagname) {
        if (isTitle) isTitle = false;
        htmlString += `</${tagname}>`;
        if (wordCount > 400) {
          insertPage();
        }
      },
      onerror: function(err) {
        console.log(err);
      },
      onend: function() {
        if (htmlString) insertPage();
        console.log(JSON.stringify(book));
        resolver(book);
      }
    },
    { decodeEntities: true }
  );
}
