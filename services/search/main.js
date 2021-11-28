const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

var corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const dotenv = require("dotenv");
const { verifyJwt } = require("./utils/jwt_utils");
const { notifyTrackerBookSearch } = require("./utils/tracker");
dotenv.config();

const port = process.env.PORT || 5004;
const hostIp = process.env.HOSTBINDIP || "localhost";
const mongo_uri = process.env.MONGO_URI;

if (mongo_uri == undefined || mongo_uri == null) {
  console.error("MONGO_URI needs to be defined!");
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

// Search endpoint
app.get('/search', verifyJwt, async (req, res) => {
  res.header('Content-Type', 'application/json');

  var query = req.query.q;
  var limit = parseInt(req.query.limit) || 12; // if no limit specified, take 12

  const bookCollection = client.db('delibanne').collection('books');

  if (query == undefined) {
    // Bad request
    res.status(400).send(JSON.stringify({ message: "Bad request, query for search is required. " }));
    return;
  }

  const aggQuery = [
    {
      $search: {
        index: "books",
        text: {
          query: query,
          path: {
            wildcard: "*"
          }
        }
      }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "bookID",
        as: "reviews"
      }
    },
    {
      $project: {
        title: 1,
        author: 1,
        isbn13: 1,
        olid: 1,
        nstars: { $ifNull: [{ $avg: "$reviews.nstars" }, 0] }
      }
    }
  ];

  const result = await bookCollection.aggregate(aggQuery).toArray();

  res.status(200).send(JSON.stringify(result));

  // if the user is signed in, (i.e., req has a jwt)
  // notify the tracker of this search
  if (req.hasJwt) {
    notifyTrackerBookSearch(query, req.cookies.jwt);
  }
})

function startListening() {
  app.listen(port, () => {
    console.log(`search service running at http://${hostIp}:${port}`);
  });
}
