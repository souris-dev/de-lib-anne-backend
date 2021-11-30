const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");

var corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const dotenv = require("dotenv");
const { verifyJwt } = require("./utils/jwt_utils");
const { notifyTrackerBookVisit } = require("./utils/tracker");
dotenv.config();

const port = process.env.PORT || 5000;
const hostIp = process.env.HOSTBINDIP || "localhost";
const mongo_uri = process.env.MONGO_URI;

if (mongo_uri == undefined || mongo_uri == null) {
  console.error("MONGO_URI needs to be defined!");
  process.exit(-1);
}

if (
  process.env.JWT_TOKEN_SECRET == undefined ||
  process.env.JWT_TOKEN_SECRET == null
) {
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
app.get("/bookdets-reviews", verifyJwt, async (req, res) => {
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
    bookDet: {
      ...result,
      nstars: average == null || average.length == 0 ? 0 : average[0].avgStars,
    },
    reviews: resRev == null ? [] : resRev,
  };
  res.status(200).send(JSON.stringify(finalDetails));

  // notify the tracker about the visit if the request had a jwt
  // that is, if the user was signed in
  if (req.hasJwt) {
    notifyTrackerBookVisit(bookISBN, req.cookies.jwt);
  }
});

// Post book review
app.post("/createreview", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no JWT was sent by the client
    res
      .status(403)
      .json({ message: "A valid JWT is required for this endpoint" });
    return;
  }
  const jwtInfo = req.decodedJwt;
  let userId = jwtInfo._id;
  userId = ObjectId(userId);

  const reviewCollection = client.db("delibanne").collection("reviews");
  const bookCollection = client.db("delibanne").collection("books");
  const userCollection = client.db("delibanne").collection("users");
  const review = req.body.review;
  const nstars = req.body.nstars;
  const bookIsbn = req.body.isbn13;

  const bookRes = await bookCollection.findOne({ isbn13: bookIsbn });
  const revAuthor = await userCollection.findOne({ _id: userId });

  // inserting review
  const reviewDets = await reviewCollection.insertOne({
    review: review,
    nstars: nstars,
    reviewAuthor: revAuthor.username,
    bookID: bookRes._id,
  });

  res
    .status(200)
    .json({ message: "Review inserted: Success", _id: reviewDets.insertedId });
});

// Adding book to the books collection in database
app.post("/addbook", async (req, res) => {});

function startListening() {
  app.listen(port, () => {
    console.log(`book_details service running at http://${hostIp}:${port}`);
  });
}
