const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const { verifyJwt } = require("./utils/jwt_utils");
const cookieParser = require("cookie-parser");

app.use(cors());
app.use(express.json());
app.use(cookieParser());

dotenv.config();

const port = process.env.PORT || 5006;
const hostIp = process.env.HOSTBINDIP || "localhost";
const mongo_uri = process.env.MONGO_URI;

if (mongo_uri == undefined || mongo_uri == null) {
  console.error("MONGO_URI needs to be defined!");
  process.exit(-1);
}

if (process.env.JWT_TOKEN_SECRET == undefined || process.env.JWT_TOKEN_SECRET == null) {
  console.error("The JWT_TOKEN_SECRET variable needs to be defined!");
  process.exit(-1);
}

const client = new MongoClient(mongo_uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

client.connect((error) => {
  if (error) {
    console.log(error);
    process.exit(-1);
  }

  startListening();
});


// POST endpoint for tracking book visits
// only tracks and puts things into db if an user is signed in
app.post("/onbookvisit", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no tracking if there's no jwt
    res.status(200).send(JSON.stringify({ message: "No jwt, no tracking." }));
    return;
  }

  const openedIsbn13 = req.body.isbn13;
  const userId = req.decodedJwt._id;
  const bookCollection = client.db('delibanne').collection('books');
  const userActivityBooksCollection = client.db('delibanne').collection('useractivitybooks');

  // fetch the book and its tags, authors
  const book = await bookCollection.findOne({ isbn13: openedIsbn13 });

  if (book == null) {
    // no book with that isbn13
    res.status(404).res(JSON.stringify({ message: "No book with that ISBN13" }));
    return;
  }

  // if the book is found, insert that book's tags as a new record (document)
  // in case of one-to-manymanymany, it is preferred to create a new document
  // for each of the "manymanymany" and back reference these records to the
  // "one" in the "one-to-manymanymany"
  // and that is why we are not using just one document and storing all tags in it
  await userActivityBooksCollection.insertOne(
    {
      userID: ObjectId(userId),
      tags: book.tags,
      author: book.author,
      at: new Date()
    });

  console.log("Book visit tracked."); //debug
  // return ok
  res.status(200).send(JSON.stringify({ message: "Book visit tracked." }));
});


// POST endpoint to track searches made by the user on the website
// only tracks searches and puts things into db if user is signed in
app.post("/onsearch", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no tracking if there's no jwt
    console.log("No jwt."); //debug
    res.status(200).send(JSON.stringify({ message: "No jwt, no tracking." }));
    return;
  }

  const userId = req.decodedJwt._id;

  const userActivitySearchesCollection = client.db('delibanne').collection('useractivitysearches');
  await userActivitySearchesCollection.insertOne(
    {
      userID: ObjectId(userId),
      searchTerm: req.body.searchTerm,
      at: new Date()
    });

  console.log("Search tracked."); //debug
  // return ok
  res.status(200).send(JSON.stringify({ message: "Search tracked." }));
})

function startListening() {
  app.listen(port, () => {
    console.log(`usertrack service running at http://${hostIp}:${port}`);
  });
}
