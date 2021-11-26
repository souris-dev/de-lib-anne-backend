const express = require("express");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { makeJwt } = require("./utils/jwt_utils");

const app = express();
// "Middleware": Web (request) -> (middleware) -> handler
app.use(cors()); // enable access from any origin
app.use(express.json());
app.use(cookieParser());

const dotenv = require("dotenv");
dotenv.config();

// load the required variables from the .env
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

// Sign In endpoint
app.post("/auth", async (req, res) => {
  res.set("Content-Type", "application/json");

  const userCollection = client.db("delibanne").collection("users");
  var userEmail = req.body.email;
  var plainTextPassword = req.body.password;

  var result = await userCollection.findOne({ email: userEmail });

  if (result == null) {
    // no user with that email
    res.status(404).send(JSON.stringify({ message: "User not found" }));
    return;
  }

  // in bcrypt.compare, first arg is plaintext and the
  // other is hashed one from before
  var isPassMatching = await bcrypt.compare(plainTextPassword, result.password);

  if (isPassMatching) {
    // right email for the right password

    // send a cookie with a jwt that expires in the set time (as specified in the line below)
    const expiry = { duration: '3h', time: new Date(Date.now() + 3 * 60 * 60 * 1000) }
    res.cookie('jwt', makeJwt({ _id: result._id, email: userEmail }, expiry.duration), { expires: expiry.time, httpOnly: true })
    res.status(200).send(JSON.stringify({ message: "Auth OK", username: result.username }));
  } else {
    // wrong password
    res.status(400).send(JSON.stringify({ message: "Wrong password" }));
  }
});

// Sign Up endpoint
app.post("/createuser", async (req, res) => {
  const userCollection = client.db("delibanne").collection("users");
  const reqbody = req.body;

  var username = reqbody.username;
  var email = reqbody.email;
  var plainPass = reqbody.password;
  var hashedPass = await bcrypt.hash(plainPass, 10);
  var interests = reqbody.interests;

  var result = await userCollection.findOne({ email: email });

  if (result != null) {
    res
      .status(400)
      .send(JSON.stringify({ message: "User with same email already exists" }));
    return;
  }

  try {
    await userCollection.insertOne({
      username: username,
      email: email,
      password: hashedPass,
      interests: interests,
    });

    // send a cookie with a jwt that expires in the set time (as specified in the line below)
    const expiry = { duration: '3h', time: new Date(Date.now() + 3 * 60 * 60 * 1000) }
    res.cookie('jwt', makeJwt({ _id: result._id, email: userEmail }, expiry.duration), { expires: expiry.time, httpOnly: true })
    res.status(200).send(JSON.stringify({ message: "User created", username: username }));
  } catch (error) {
    res.status(500).send(JSON.stringify({ message: error.toString() }));
  }
});

// logout endpoint
app.post("/logout", (req, res) => {
  // to delete a cookie, just set its expiry time to the past
  res.cookie('jwt', '', { expires: new Date(Date.now() - 10000) });
  res.header('Content-Type', "application/json");
  res.status(200).send(JSON.stringify({ message: "Logged out" }));
})

app.post('/sendotp', (req, res) => {
  
});

function startListening() {
  app.listen(port, () => {
    console.log(`auth service listening at http://${hostIp}:${port}`);
  });
}
