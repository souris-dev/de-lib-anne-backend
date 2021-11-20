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
