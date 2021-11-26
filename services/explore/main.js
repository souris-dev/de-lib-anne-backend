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

/**
 * Possible optimization:
 * Previous reviews:
 * (a1 + a2 + a3 + ...) / n = alpha
 *
 * New review x added:
 * (a1 + a2 + a3 + ... + x) / (n + 1) = alpha + beta
 *
 * n/(n + 1) alpha + x/(n + 1) = alpha + beta
 * beta = n/(n + 1) alpha + x/(n + 1) - alpha
 * beta = x/(n + 1) - (1 - n/(n + 1)) alpha
 * beta = (x - alpha) / (n + 1)
 *
 * Where,
 * previous avg_nstars = alpha
 * previous nreviews = n 
 * new avg_nstars = alpha + beta
 */

// Book details + reviews endpoint
app.get("/bookdets-reviews", async (req, res) => {
  res.set("Content-Type", "application/json");

  const reviewCollection = client.db("delibanne").collection("reviews");
  const bookCollection = client.db("delibanne").collection("books");

  var bookISBN = req.query.isbn13;

  var result = await bookCollection.findOne({ isbn13: bookISBN });
  if (result == null) {
    //no book with the specified ISBN
    res.status(404).send(JSON.stringify({ message: "Book not found" }));
    return;
  }

  var resRev = await reviewCollection.find({ bookID: result._id }).toArray();

  // calculating nstars
  const average = await reviewCollection
    .aggregate([
      {
        $group: {
          _id: "$bookID",
          avgStars: { $avg: "$nstars" },
        },
      },
      {
        $match: { _id: result._id },
      },
    ])
    .toArray();

  var finalDetails = {
    bookDet: { ...result, nstars: average[0].avgStars },
    reviews: resRev == null ? [] : resRev,
  };
  res.status(200).send(JSON.stringify(finalDetails));
});

// Post book review
app.post("/createreview", (req, res) => {

});

function startListening() {
  app.listen(port, () => {
    console.log(`book_details service running at http://${hostIp}:${port}`);
  });
}
