const db = require("../db");

const { random, uniqBy, toPairs } = require("lodash");
const { frequencies } = require("lodash-contrib");
const fetch = require("node-fetch");

const { ObjectId } = require("mongodb");

const dbclient = db.getDbClient().db('delibanne');
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || "http://dla_search:5004";

// Generates recommendations for general person
async function getExplore() {
  return { interestTags: [], recommendations: [] };
}


// Generates recommendations for a signed in user
// userId: object Id of the user in the db
// retrieved from the jwt
// Returns 2 things: the recommendations
// and also the tags that the user likes (based on book visits)
async function getExploreWithRecommendations(userId, client) {
  const bookvisitCollection = dbclient.collection('useractivitybooks');
  const searchCollection = dbclient.collection('useractivitysearches');

  // tweak these as required

  // no. of latest bookvisit records to take:
  const nbookvisits = 5;
  // no. of latest searches to take:
  const nsearches = 5;
  const ntotal = nbookvisits + nsearches;

  // the probability that the author of a book visit
  // will be included in the interest keywords (for each book visit)
  const authorProb = 0.7;

  // how many times to run random searches based on the keywords
  const niter = 3;

  // get the user's latest book visits and searches
  const bookVisits = bookvisitCollection.find({ userID: ObjectId(userId) }, { limit: nbookvisits }).sort({ at: -1 });
  const searches = searchCollection.find({ userID: ObjectId(userId) }, { limit: nsearches }).sort({ at: -1 });

  // this is not a set because then we won't be 
  // able to capture the frequency of keywords being added to it
  // hence, we actually do need duplication here so that the 
  // probability of more prevelant keywords being chosen is higher
  var interestKeywords = [];
  var interestTags = []; // stores only tags, will be needed later

  if (bookVisits == null && searches == null) {
    // no tracked activity of the user
    // so return general recommendations
    return getExplore();
  }

  if (bookVisits) {
    bookVisits.forEach((bookVisit) => {
      interestKeywords.push(...bookVisit.tags);
      interestTags.push()

      // by a given probability, include the author
      if (Math.random() > authorProb) {
        interestKeywords.push(bookVisit.author);
      }
    })
  }

  if (searches) {
    searches.forEach((search) => {
      interestKeywords.push(search.searchTerm);
    })
  }

  // get the most frequently visited tags and the recommendations
  const allResults = await Promise.all([getMostFrequentTags(interestKeywords), getRandomSearches(niter)]);
  return { interestTags: allResults[0], recommendations: allResults[1] };
}

async function getMostFrequentTags(tagsArray) {
  // TODO: We may want to use a better method for
  // finding the most occuring elements in the interestTags
  // array so that we can return the ones with highest frequency

  const getFreqs = (array) => {
    var counts = {}

    for (const elem of array) {
      counts[elem] = counts[elem] ? counts[elem] + 1 : 1;
    }

    return counts;
  }

  // below, interestTagsCount is of the form:
  // { 'tag1': 5, 'tag2': 3, 'tag3': 4 }
  // where the value of each key is its frequency
  var interestTagsCounts = getFreqs(tagsArray);

  // now, interestTagsCountsArray is of the form:
  // [['tag1', 5], ['tag2', 3], ['tag3', 4]]
  // doing this makes sorting easier
  var interestTagsCountsArray = toPairs(interestTagsCounts);
  interestTagsCountsArray.sort((a, b) => b[1] - a[1]); // sort in descending order

  //  the variable below should hold data in the form:
  // ['tag1', 'tag3', 'tag2']
  // which is the flattened form of interestTagsCountsArray
  // without the frequencies
  var sortedInterestTagsFlattened = interestTagsCountsArray.map((elem) => elem[0]);
  // above, elem is an array of the form ['tag': 4], so elem[0] gives the tag

  return sortedInterestTagsFlattened;
}

async function getRandomSearches(keywords, ntimes) {
  const results = []; // we'll make this unique later

  // minimum and maximum keywords to sample for each search:
  const MIN_KEYWORDS = 1;
  const MAX_KEYWORDS = 3;

  // minimum and maximum limit for search results:
  const MIN_SEARCH_RES_LIMIT = 3;
  const MAX_SEARCH_RES_LIMIT = 6;

  const searchUrl = SEARCH_SERVICE_URL + "/search"

  for (let i = 0; i < ntimes; i++) {
    // sample some random kewywords
    // the second arg specifies how many keywords to sample,
    // which is also a random integer

    // random is lodash's random: returns an int between the range
    // (inclusive of the given bounds)
    const randKeywords = sampleSize(keywords, random(MIN_KEYWORDS, MAX_KEYWORDS));

    // create the search URL in the form /search?q=kw1+kw2+...
    var searchUrlString = searchUrl + "?";
    const params = new URLSearchParams();
    params.set("q", randKeywords.join(" "));
    params.set("limit", random(MIN_SEARCH_RES_LIMIT, MAX_SEARCH_RES_LIMIT))
    searchUrlString = searchUrlString.concat(params.toString());

    // the searchUrlString is in now of the form http://dla_search:5004/search?q=kw1+kw2+...
    // now use the search service to get relevant books and put them into the results array
    fetch(searchUrlString, { method: "GET" })
      .then((res) => res.json())
      .then((result) => results.push(...result));
    // above, the variable result is an array of search results from the search service
  }

  // returns the results, making them unique using the 'isbn13' key
  // uniqBy is an util function from lodash
  return uniqBy(results, 'isbn13');
}

module.exports = { getExplore, getExploreWithRecommendations };