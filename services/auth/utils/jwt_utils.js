const jwt = require("jsonwebtoken");

function makeJwt(payload, expiresIn = "3h") {
    return jwt.sign(payload, process.env.JWT_TOKEN_SECRET, { expiresIn: expiresIn })
}

module.exports = { makeJwt };