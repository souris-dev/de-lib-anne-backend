const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT || 5004;
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

// Search endpoint
app.get('/search', async (req, res) => {
  res.header('Content-Type', 'application/json');

  var query = req.query.q;
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
          },
          fuzzy: {}
        }
      }
    },
    {
      $limit: 12
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
})

function startListening() {
  app.listen(port, () => {
    console.log(`search service running at http://${hostIp}:${port}`);
  });
}
