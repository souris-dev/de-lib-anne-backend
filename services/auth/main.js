const express = require("express");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { makeJwt } = require("./utils/jwt_utils");
const nodemailer = require("nodemailer");

const app = express();

const dotenv = require("dotenv");
dotenv.config();

// "Middleware": Web (request) -> (middleware) -> handler
var corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// initializing a transporter object to send emails
if (process.env.EMAIL_ID == null || process.env.GMAIL_PASSWORD == null) {
  console.error(
    "Auth service needs the variables EMAIL_ID and GMAIL_PASSWORD to be defined in the environment."
  );
  process.exit(-1);
}

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.GMAIL_PASSWORD,
  },
});

/**
 * Generates a 6 digit random number.
 */
function getRandomNumber() {
  min = 100000;
  max = 999999;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// load the required variables from the .env
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
    const expiry = {
      duration: "3h",
      time: new Date(Date.now() + 3 * 60 * 60 * 1000),
    };
    res.cookie(
      "jwt",
      makeJwt({ _id: result._id, email: userEmail }, expiry.duration),
      { expires: expiry.time, httpOnly: true }
    );
    res
      .status(200)
      .send(JSON.stringify({ message: "Auth OK", username: result.username }));
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
    let insertedDoc = await userCollection.insertOne({
      username: username,
      email: email,
      password: hashedPass,
      interests: interests,
    });

    // send a cookie with a jwt that expires in the set time (as specified in the line below)
    const expiry = {
      duration: "3h",
      time: new Date(Date.now() + 3 * 60 * 60 * 1000),
    };
    res.cookie(
      "jwt",
      makeJwt({ _id: insertedDoc.insertedId, email: email }, expiry.duration),
      { expires: expiry.time, httpOnly: true }
    );
    res
      .status(200)
      .send(JSON.stringify({ message: "User created", username: username }));
  } catch (error) {
    res.status(500).send(JSON.stringify({ message: error.toString() }));
  }
});

// logout endpoint
app.post("/logout", (req, res) => {
  // to delete a cookie, just set its expiry time to the past
  res.cookie("jwt", "", { expires: new Date(Date.now() - 10000) });
  res.header("Content-Type", "application/json");
  res.status(200).send(JSON.stringify({ message: "Logged out" }));
});

app.post("/sendotp", async (req, res) => {
  const otp = getRandomNumber();
  var email = req.body.email;

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.EMAIL_ID,
    to: email,
    subject: "DeLibAnne User Verification",
    html: `Welcome User,<br>Your user verification OTP is <h3><b>${otp}</b></h3>Thank you for registering!`,
  });
  res.header("Content-Type", "application/json");
  res.status(200).json({ message: otp });

  console.log("Message sent: %s", info);
});

app.post("/checkemail", async (req, res) => {
  res.header("Content-Type", "application/json");

  const userCollection = client.db("delibanne").collection("users");

  var email = req.body.email;

  var result = await userCollection.findOne({ email: email });

  if (result == null) {
    res.status(400).json({ message: "User with this email does not exist." });
    return;
  }
});

app.post("/forgotpassword", async (req, res) => {
  res.header("Content-Type", "application/json");

  const userCollection = client.db("delibanne").collection("users");

  const reqbody = req.body;

  var email = reqbody.email;
  var password = reqbody.password;
  var hashedPass = await bcrypt.hash(password, 10);

  var result = await userCollection.updateOne(
    { email: email },
    { $set: { password: hashedPass } }
  );
  console.log(
    `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`
  );
  if (result.matchedCount == 0) {
    res.status(400).json({ message: "User with this email does not exist" });
    return;
  }
  res.status(200).json({ message: "Password updated successfully!" });
});

function startListening() {
  app.listen(port, () => {
    console.log(`auth service listening at http://${hostIp}:${port}`);
  });
}
