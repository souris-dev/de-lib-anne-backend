const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

const dotenv = require("dotenv");
const { verifyJwt } = require("../usertrack/utils/jwt_utils");
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


app.get("/recommendations", verifyJwt, async (req, res) => {
  res.header("Content-Type", "application/json");

  var recommendations;
  if (!req.hasJwt) {
    recommendations = getExplore();
  }

  else {
    recommendations = get
  }
})


function startListening() {
  app.listen(port, () => {
    console.log(`book_details service running at http://${hostIp}:${port}`);
  });
}
