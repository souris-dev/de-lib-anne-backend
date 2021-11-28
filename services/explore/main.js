const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");

const dotenv = require("dotenv");
const { verifyJwt } = require("./utils/jwt_utils");
const db = require("./db");

app.use(express.json());
app.use(cors());
app.use(cookieParser());

dotenv.config();

const port = process.env.PORT || 5007;
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

// connect to the database
db.dbConnect(mongo_uri, startListening);

// this line must come after db.dbConnect, else these functions won't
// be able to access the db client
const { getExplore, getExploreWithRecommendations, SEARCH_SERVICE_URL } = require("./recommender/recommender");


/**
 * GET generic or specific (if request has JWT) recommendations and interests.
 */
app.get("/recommendations", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  var recommendations;
  if (!req.hasJwt) {
    recommendations = await getExplore();
  }
  else {
    const userId = req.decodedJwt._id;
    recommendations = await getExploreWithRecommendations(userId);
  }

  res.status(200).send(JSON.stringify(recommendations));
})

/**
 * GET recommendations for a keyword.
 * For now, just uses the search service's /search GET endpoint
 * with the same query, and limit set to 6.
 * Hence, this endpoint doesn't verify or check for a JWT.
 */
app.get("/recommendations/bykeyword", async (req, res) => {
  res.header("Content-Type", "application/json");
  const queryKeyword = req.query.keyword;
  console.log(queryKeyword); //debug

  // Create the url in the form /search?q=blah+blah
  const params = new URLSearchParams()
  params.set("q", queryKeyword);
  params.set("limit", 6);
  const searchQueryString = SEARCH_SERVICE_URL + "/search?" + params.toString();

  // a faster way would be to just redirect, but
  // the hostname is not known.
  // (the frontend would not understand a redirect to http://dla_search
  // because it is out of the docker network and cannot use its internal DNS).

  // so using fetch for now
  fetch(searchQueryString, { method: "GET" })
    .then((res) => res.json())
    .then((resp) => {
    res.status(200).json(resp);
  }).catch((err) => {
    res.status(500).json({ error: err });
  })
})

function startListening() {
  app.listen(port, () => {
    console.log(`explore service running at http://${hostIp}:${port}`);
  });
}
