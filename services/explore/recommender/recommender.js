const db = require("../db");

const { random, sampleSize, uniqBy, toPairs } = require("lodash");
const fetch = require("node-fetch");

const { ObjectId } = require("mongodb");

const dbclient = db.getDbClient().db('delibanne');
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || "http://dla_search:5004";

// Generates recommendations for general person
async function getExplore() {
  const booksCollection = dbclient.collection('books');

  // how many recommendations do we want?
  const NFRAC = 0.7; // fraction of total books to randomly take
  const NRANDOM_BOOKS_LIMIT = 10; // max. number of random books to take

  // for how $rand works in selecting random books below, see this:
  // https://docs.mongodb.com/manual/reference/operator/aggregation/rand/#mongodb-expression-exp.-rand
  const randomBooks = await booksCollection.aggregate(
    [
      {
        $match: { $expr: { $lt: [NFRAC, { $rand: {} }] } }
      },
      {
        $limit: NRANDOM_BOOKS_LIMIT
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
        $project: {
          title: 1,
          author: 1,
          isbn13: 1,
          olid: 1,
          nstars: { $ifNull: [{ $avg: "$reviews.nstars" }, 0] }
        }
      }
    ]
  ).toArray();

  return { interestTags: ["Fiction", "Comedy", "Mystery"], recommendations: randomBooks };
}


/**
 * Generates recommendations for a signed in user
 * @param userId: object Id of the user in the db retrieved from the jwt
 * @returns {{ interestTags: string[], recommendations: any[] }: 
 *            object containing most common interest tags and recommendations}
 */
async function getExploreWithRecommendations(userId) {
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
    await bookVisits.forEach((bookVisit) => {
      console.log("Tags for " + bookVisit.author)
      console.log(bookVisit.tags);
      interestKeywords.push(...bookVisit.tags);
      interestTags.push(...bookVisit.tags);
      console.log(interestKeywords);

      // by a given probability, include the author
      if (Math.random() > authorProb) {
        interestKeywords.push(bookVisit.author);
      }
    })
  }

  console.log("After processing book visits, interestKeywords: ");
  console.log(interestKeywords);

  if (searches) {
    await searches.forEach((search) => {
      interestKeywords.push(search.searchTerm);
    })
  }

  console.log("After processing searches, interestKeywords: ");
  console.log(interestKeywords);

  // get the most frequently visited tags and the recommendations
  const allResults = await Promise.all(
    [getMostFrequentTags(interestKeywords), getRandomSearches(interestKeywords, niter)]
  );

  console.log("Most freq tags: ");
  console.log(allResults[0]);
  return { interestTags: allResults[0], recommendations: allResults[1] };
}


/**
 * Utility functions
**/
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

  const allFetchPromises = [];

  console.log("---- Starting for loop for fetches");
  for (let i = 0; i < ntimes; i++) {
    console.log("--------------i is")
    console.log(i);
    // sample some random kewywords
    // the second arg specifies how many keywords to sample,
    // which is also a random integer

    // random is lodash's random: returns an int between the range
    // (inclusive of the given bounds)
    const randKeywords = sampleSize(keywords, random(MIN_KEYWORDS, MAX_KEYWORDS));

    // create the search URL in the form /search?q=kw1+kw2+...
    const params = new URLSearchParams();
    params.set("q", randKeywords.join(" "));
    params.set("limit", random(MIN_SEARCH_RES_LIMIT, MAX_SEARCH_RES_LIMIT))
    const searchUrlString = SEARCH_SERVICE_URL + "/search?" + params.toString();

    // the searchUrlString is in now of the form http://dla_search:5004/search?q=kw1+kw2+...
    // now use the search service to get relevant books and put them into the results array

    // push the promise returned to an array so that we can await on all of them
    // later using Promise.all
    console.log("Sending fetch: ");
    allFetchPromises.push(fetch(searchUrlString, { method: "GET" })
      .then((res) => res.json())
      .then((result) => {
        console.log("Result received: ");
        console.log(result);
        results.push(...result)
      }));
    // above, the variable result is an array of search results from the search service
  }

  console.log("All fetch promises: ");
  console.log(allFetchPromises);
  // wait for all the search fetches to complete
  await Promise.all(allFetchPromises);

  console.log("After awaiting them all, results: ");
  console.log(results);

  // return the results, making them unique using the 'isbn13' key
  // uniqBy is an util function from lodash
  return uniqBy(results, 'isbn13');
}

module.exports = { SEARCH_SERVICE_URL, getExplore, getExploreWithRecommendations };