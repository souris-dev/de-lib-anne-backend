const express = require('express')
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const app = express();
const cors = require('cors');

// "Middleware": Web (request) -> (middleware) -> handler
app.use(express.json());
app.use(cors()); // enable access from any origin

const dotenv = require('dotenv');
dotenv.config();

const port = process.env.PORT || 5000;
const hostIp = process.env.HOSTBINDIP || "localhost";
const mongo_uri = process.env.MONGO_URI;

const client = new MongoClient(mongo_uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect((error) => {
  if (error) {
    console.log(error);
    process.exit(-1);
  }

  startListening();
})

// Sign In endpoint
app.post('/auth', async (req, res) => {
  const userCollection = client.db("delibanne").collection("users");
  var userEmail = req.body.email;
  var plainTextPassword = req.body.password;

  var result = await userCollection.findOne({ email: userEmail });

  if (result == null) {
    // no user with that email
    res.status(404).send({ message: "User not found" });
    return;
  }

  // in bcrypt.compare, first arg is plaintext and the
  // other is hashed one from before
  var isPassMatching = await bcrypt.compare(plainTextPassword, result.password);

  if (isPassMatching) {
    // wrong password
    res.status(200).send(JSON.stringify({ message: "Auth OK" }));
  }
  else {
    // right email for the right password
    res.status(400).send(JSON.stringify({ message: "Wrong password" }));
  }
})

// Sign Up endpoint
app.post('/createuser', async (req, res) => {
  const userCollection = client.db("delibanne").collection("users");
  const reqbody = req.body;

  var username = reqbody.username;
  var email = reqbody.email;
  var plainPass = reqbody.password;
  var hashedPass = await bcrypt.hash(plainPass, 10);
  var interests = reqbody.interests;

  var result = await userCollection.findOne({ email: email });

  if (result != null) {
    // no user with that email
    res.status(400).send(JSON.stringify({ message: "User with same email already exists" }));
    return;
  }

  try {
    await userCollection.insertOne(
      {
        username: username,
        email: email,
        password: hashedPass,
        interests: interests
      }
    );

    res.status(200).send(JSON.stringify({ message: "User created" }));
  }
  catch (error) {
    res.status(500).send(JSON.stringify({ message: error.toString() }));
  }
})

function startListening() {
  app.listen(port, () => {
    console.log(`Example app listening at http://${hostIp}:${port}`);
  })
}
