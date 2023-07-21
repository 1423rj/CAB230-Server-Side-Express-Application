const { redirect } = require('express/lib/response');
const jwt = require('jsonwebtoken');
const invalidToken = [];

module.exports = function (req, res, next) {
  const { email } = req.params;


  if (invalidToken.includes(req.body.refreshToken)) {
    res.status(401).json({ error: true, message: "Invalid JWT token" });
    return;

  }
  else if (req.path.endsWith("/profile")) {
    next();
  }
  else if (req.path.endsWith("/refresh")) {
    next();
  }
  else if (req.path.endsWith("/logout")) {
    invalidToken.push(req.body.refreshToken)
    next()
  }

  else if (!("authorization" in req.headers) || !req.headers.authorization.match(/^Bearer /)) {
    // Authorization header is not found
    res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
  } else {
    const token = req.headers.authorization.replace(/^Bearer /, "");

    try {
      jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (e) {
      if (e.name === "TokenExpiredError") {
        res.status(401).json({ error: true, message: "JWT token has expired" });
      } else {
        res.status(401).json({ error: true, message: "Invalid JWT token" });
      }
    }
  }
};