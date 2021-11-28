const { MongoClient } = require("mongodb");

let client;

function dbConnect(mongo_uri, callback) {
  client = new MongoClient(mongo_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

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