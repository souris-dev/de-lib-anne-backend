const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { verifyJwt } = require("./utils/jwt_utils");

app.use(express.json());
app.use(cors());
app.use(cookieParser());

const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT || 5005;
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

// PUT Endpoint to add a wishlist item
// Needs a valid JWT
app.put("/addwishitem", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no JWT was sent by the client
    res.status(403).send(JSON.stringify({ message: "A valid JWT is required for this endpoint." }));
    return;
  }

  // if we are here, it means that we have a valid JWT that has been verified
  const jwtInfo = req.decodedJwt; // comes from the middleware verifyJwt
  const userId = jwtInfo._id;
  const bookToAddIsbn13 = req.body.isbn13;

  const wishlistCollection = client.db("delibanne").collection("wishlist");
  const bookCollection = client.db("delibanne").collection("books");

  // first fetch the object id of that book
  var resBook = await bookCollection.findOne({ isbn13: bookToAddIsbn13 }, { project: { _id: 1 } });

  if (resBook == null) {
    // no book with that isbn13
    // bad request
    res.send(400).send(JSON.stringify({ message: "No book with that isbn13 is present in our collection." }));
    return;
  }

  // $addToSet because if that book already exists, we don't need to add it again
  const updateRes = await wishlistCollection.updateOne(
    {
      userId: userId
    },
    {
      $addToSet: { wishlist: resBook._id }
    });

  if (updateRes.matchedCount == 1 && updateRes.modifiedCount == 1) {
    // all ok, one record matched and modified
    res.status(200).send(JSON.stringify({ message: "Wishlist book addition: success." }));
    return;
  }
  else if (updateRes.matchedCount == 0) {
    // create a wishlist record for this user
    const newWishlist = await wishlistCollection.insertOne(
      { userID: ObjectId(userId), wishlist: [resBook._id] }
    );

    res.status(200).send(JSON.stringify({ message: "Wishlist creation and book addition: success." }));
    return;
  }

  // if we are here, that means something weird happened, so something went wrong
  res.status(500).send(JSON.stringify({ message: "Something weird happened during updation of the wishlist." }));
})

// GET wishlist items
// Requires a valid JWT
app.get("/getwishlist", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no JWT was sent by the client
    res.status(403).send(JSON.stringify({ message: "A valid JWT is required for this endpoint." }));
    return;
  }

  // if we are here, it means that we have a valid JWT that has been verified
  const jwtInfo = req.decodedJwt; // comes from the middleware verifyJwt
  const userId = jwtInfo._id;

  const wishlistCollection = client.db('delibanne').collection('wishlist');

  const wishResult = await wishlistCollection.aggregate([
    {
      $match: {
        userID: ObjectId(userId)
      }
    },
    {
      $lookup: {
        from: "books",
        localField: "wishlist",
        foreignField: "_id",
        as: "wishlistBooks",
      },
    },
    {
      $unwind: "$wishlistBooks",
    },
    {
      $replaceRoot: { newRoot: "$wishlistBooks" }
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
      $addFields: {
        nstars: { $avg: "$reviews.nstars" }
      }
    },
    {
      $project: {
        _id: 0,
        title: 1,
        author: 1,
        summary: 1,
        nstars: 1,
        olid: 1,
        isbn13: 1
      }
    }
  ]).toArray();

  if (wishResult == null) {
    // no wishlist for this user, return empty array
    res.status(200).send(JSON.stringify({ userWishlist: [] }));
    return;
  }

  res.status(200).send(JSON.stringify({ userWishlist: wishResult }));
})

// DELETE wishlist item
// Requires a valid JWT
app.delete("/deletewishitem", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  if (!req.hasJwt) {
    // no JWT was sent by the client
    res.status(403).send(JSON.stringify({ message: "A valid JWT is required for this endpoint." }));
    return;
  }

  // if we are here, it means that we have a valid JWT that has been verified
  const jwtInfo = req.decodedJwt; // comes from the middleware verifyJwt
  const userId = jwtInfo._id;
  const toDeleteIsbn13 = req.body.isbn13;

  const wishlistCollection = client.db('delibanne').collection('wishlist');
  const bookCollection = client.db('delibanne').collection('books');

  var bookRes = await bookCollection.findOne({ isbn13: bookISBN });
  if (bookRes == null) {
    //no book with the specified ISBN
    res.status(404).send(JSON.stringify({ message: "Book not found" }));
    return;
  }

  const result = await wishlistCollection.updateOne(
    {
      userId: ObjectId(userId)
    },
    {
      $pull: { wishlist: bookRes._id }
    }
  );

  if (result.matchedCount == 1 && result.modifiedCount == 1) {
    // all good
    res.status(200).send(JSON.stringify({ message: "Book deleted successfully from wishlist." }));
    return;
  }

  // no match
  res.status(404).send(JSON.stringify({ message: "No updation was done. All OK." }));
})

function startListening() {
  app.listen(port, () => {
    console.log(`wishlist service running at http://${hostIp}:${port}`);
  });
}
