const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT || 5000;
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

app.post("/onbookdetailsopen", verifyJwt, (req, res) => {
  res.header("Content-Type", "application/json");

  if (!res.hasJwt) {
    // no tracking if there's no jwt
    res.status(200).send(JSON.stringify({ message: "No jwt, no tracking." }));
    return;
  }

  const openedIsbn13 = req.body.isbn13;
  const bookCollection = client.db('delibanne').collection('books');

  // fetch the book and its tags, authors
  const book = await bookCollection.findOne({ isbn13:  })
});

app.post("/onbooksearch", verifyJwt, (req, res) => {
  res.header("Content-Type", "application/json");

  if (!res.hasJwt) {
    // no tracking if there's no jwt
    res.status(200).send(JSON.stringify({ message: "No jwt, no tracking." }));
    return;
  }
})

function startListening() {
  app.listen(port, () => {
    console.log(`book_details service running at http://${hostIp}:${port}`);
  });
}
