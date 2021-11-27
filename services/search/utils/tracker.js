const fetch = require("node-fetch");

const TRACKER_URL = process.env.TRACKER_SERVICE_URL || 'http://dla_usertrack:5006'

const notifyTrackerBookSearch = (searchTerm, jwt) => {
  fetch(TRACKER_URL + '/onsearch', {
    method: 'POST',
    body: JSON.stringify({ searchTerm: searchTerm }),
    headers: {
      'content-type': 'application/json',
      'cookie': `jwt=${jwt}`
    }
  }).catch((err) => {
    console.error("Failed to track book visit: ");
    console.error(err);
  })
}

module.exports = { TRACKER_URL, notifyTrackerBookSearch };