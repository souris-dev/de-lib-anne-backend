const jwt = require("jsonwebtoken");

/**
 * This middleware sets two properties in the request object:
 * req.hasJwt: this is set to true if the request contains a cookie that has a jwt, else false
 * req.decodedJwt: if req.hasJwt is true, then req.decodedJwt contains the decodedJwt
 * 
 * In case the JWT is expired or contains errors, a 403 Forbidden is sent back as response
 * with the error in the body.
 */
function verifyJwt(req, res, next) {
  const TOKEN_SECRET = process.env.JWT_TOKEN_SECRET;

  if (!req.cookies.jwt) {
    req.hasJwt = false;
    next();
    return;
  }

  // get the jwt from the cookie
  jwt.verify(req.cookies.jwt, TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).send(JSON.stringify(err));
      return;
    }

    req.hasJwt = true;
    req.decodedJwt = decoded;
    next();
  });
}

module.exports = { verifyJwt };