const { MongoClient } = require("mongodb");

const mongo_uri = process.env.MONGO_URI;

if (mongo_uri == undefined || mongo_uri == null) {
  console.error("MONGO_URI needs to be defined!");
  process.exit(-1);
}

const client = new MongoClient(mongo_uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function dbConnect(callback) {
  client.connect((error) => {
    if (error) {
      console.log(error);
      process.exit(-1);
    }
  
    callback();
  });
}

function close() {
  client.close();
}

function getDbClient() {
  return client;
}

module.exports = {
  dbConnect, getDbClient, close
}