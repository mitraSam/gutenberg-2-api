const htmlparser = require("htmlparser2");
const fetch = require("node-fetch");
const { verify, sign } = require("jsonwebtoken");

function htmlParser(res, rej) {
  let isTitle = false;
  let wordCount = 0;
  let pageNr = 0;
  let htmlString = "";
  let book = [];
  let titles = [];
  let currentChapter;
  let totalPagesNr = 0;
  let tags = [];
  function insertPage() {
    currentChapter.pages.push({ content: htmlString, pageNr: ++pageNr });
    htmlString = "";
    wordCount = 0;
    totalPagesNr++;
  }

  return new htmlparser.Parser(
    {
      onopentag: function(name) {
        tags.push(name);
        if (name === "h2") {
          if (htmlString) insertPage();
          if (currentChapter) currentChapter.pagination.push(pageNr);
          book.push({ pages: [], pagination: [pageNr + 1] });
          currentChapter = book[book.length - 1];
          isTitle = true;
        }
        htmlString += `<${name}>`;
      },
      ontext: function(text) {
        wordCount += text.split(" ").length;
        if (isTitle) {
          currentChapter.title = text;
          titles.push(text);
        }
        htmlString += text;
      },
      onclosetag: function(tagname) {
        tags.pop();
        if (tags.length) return;
        if (isTitle) isTitle = false;
        htmlString += `</${tagname}>`;
        if (wordCount > 400) {
          insertPage();
        }
      },
      onerror: function(err) {
        rej(err);
      },
      onend: function() {
        if (htmlString) insertPage();
        if (currentChapter) currentChapter.pagination.push(pageNr);
        book.titles = titles;
        book.pagesNr = totalPagesNr;
        res(book);
      }
    },
    { decodeEntities: true }
  );
}
function generateToken(username) {
  const secret = process.env.JWT_SECRET;
  return sign({ data: username }, secret, { expiresIn: 10 * 60 });
}
function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  try {
    var decoded = verify(token, secret);
  } catch (err) {
    return null;
    // err
  }
  return decoded;
}

const fetchWiki = async param => {
  const data = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${param}`
  );
  const dataToJson = await data.json();
  return dataToJson.extract;
};
module.exports = {
  streamParser: stream =>
    new Promise((res, rej) => stream().pipe(htmlParser(res, rej))).catch(
      console.log
    ),
  fetchWiki,
  generateToken,
  verifyToken
};
