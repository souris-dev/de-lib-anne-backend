const express = require("express");
const app = express();
const cors = require("cors");
const db = require("./db");

app.use(express.json());
app.use(cors());

const dotenv = require("dotenv");
const { verifyJwt } = require("../usertrack/utils/jwt_utils");
const { getExplore, getExploreWithRecommendations, SEARCH_SERVICE_URL } = require("./recommender/recommender");
dotenv.config();

const port = process.env.PORT || 5007;
const hostIp = process.env.HOSTBINDIP || "localhost";

if (process.env.JWT_TOKEN_SECRET == undefined || process.env.JWT_TOKEN_SECRET == null) {
  console.error("The JWT_TOKEN_SECRET variable needs to be defined!");
  process.exit(-1);
}

// connect to the database
db.dbConnect(startListening);

app.get("/recommendations", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  var recommendations;
  if (!req.hasJwt) {
    recommendations = getExplore(client);
  }
  else {
    const userId = req.decodedJwt._id;
    recommendations = getExploreWithRecommendations(userId, client);
  }

  res.status(200).send(JSON.stringify(recommendations));
})

/**
 * For now, just redirects to the search service's /search GET endpoint
 * with the same query, and limit set to 6.
 */
app.get("/recommendations/bykeyword", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");
  const queryKeyword = req.query.keyword;
  console.log(queryKeyword); //debug

  // Create the url in the form /search?q=blah+blah
  const params = new URLSearchParams()
  params.set("q", queryKeyword);
  params.set("limit", 6);
  const searchQueryString = SEARCH_SERVICE_URL + "/search?" + params.toString();

  res.redirect(searchQueryString);
})

function startListening() {
  app.listen(port, () => {
    console.log(`book_details service running at http://${hostIp}:${port}`);
  });
}
