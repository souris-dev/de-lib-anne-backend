const fetch = require("node-fetch");

const TRACKER_URL = process.env.TRACKER_SERVICE_URL || 'http://dla_usertrack:5006'

const notifyTrackerBookVisit = (isbn13, jwt) => {
  fetch(TRACKER_URL + '/onbookvisit', {
    method: 'POST',
    body: JSON.stringify({ isbn13: isbn13 }),
    headers: {
      'content-type': 'application/json',
      'cookie': `jwt=${jwt}`
    }
  }).catch((err) => {
    console.error("Failed to track book visit: ");
    console.error(err);
  })
}

module.exports = { TRACKER_URL, notifyTrackerBookVisit };