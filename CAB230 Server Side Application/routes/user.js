var express = require('express');
var router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authorization = require('../middleware/authorization');
const JWT_SECRET = process.env.JWT_SECRET;

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

router.post('/refresh', authorization, (req, res, next) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, refresh token required"
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const email = decoded.email;
    if (decoded.exp2 < Date.now() / 1000) {
      return res.status(401).json({
        error: true,
        message: "JWT token has expired"
      });
    }

    const expires_in_refresh = req.body.refreshExpiresInSeconds || 60 * 60 * 24; // 24 hours
    const expires_in = req.body.bearerExpiresInSeconds || 60 * 10;
    const exp2 = Math.floor(Date.now() / 1000) + expires_in_refresh;
    const exp = Math.floor(Date.now() / 1000) + expires_in;
    const token = jwt.sign({ email, exp }, process.env.JWT_SECRET);
    const refresh = jwt.sign({ email, exp2 }, process.env.JWT_SECRET);
    const bearerToken = {
      token: token,
      token_type: "Bearer",
      expires_in: expires_in
    };
    const refreshT = {
      token: refresh,
      token_type: "Refresh",
      expires_in: expires_in_refresh
    };
    return res.status(200).json({
      bearerToken: bearerToken,
      refreshToken: refreshT
    });
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
  }
});

router.post('/logout', authorization, (req, res, next) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, refresh token required"
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.exp2 < Date.now() / 1000) {
      return res.status(401).json({
        error: true,
        message: "JWT token has expired"
      });
    }
    decoded.exp2 = Math.floor(Date.now() / 1000);
    return res.status(200).json({
      error: false,
      message: "Token successfully invalidated",
    });
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      return res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
  }
});

router.post('/login', function (req, res, next) {
  const email = req.body.email;
  const password = req.body.password;
  let proceed = true;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete - email and password needed"
    });
  }

  const queryUsers = req.db.from("users").select("*").where("email", "=", email);
  queryUsers
    .then(users => {
      if (users.length === 0) {
        proceed = false;
        return res.status(401).json({
          error: true,
          message: "User does not exist"
        });
      }
      const user = users[0];
      return bcrypt.compare(password, user.hash);
    })
    .then(match => {
      if (!match) {
        return res.status(401).json({
          error: true,
          message: "Not a match"
        });
      }
      if (proceed) {
        const expires_in_refresh = req.body.refreshExpiresInSeconds || 60 * 60 * 24;
        const expires_in = req.body.bearerExpiresInSeconds || 60 * 10;
        const exp = Math.floor(Date.now() / 1000) + expires_in;
        const exp2 = Math.floor(Date.now() / 1000) + expires_in_refresh;
        const token = jwt.sign({ email, exp }, process.env.JWT_SECRET);
        const refresh = jwt.sign({ email, exp2 }, process.env.JWT_SECRET);
        const bearerToken = {
          token: token,
          token_type: "Bearer",
          expires_in: expires_in
        };
        const refreshToken = {
          token: refresh,
          token_type: "Refresh",
          expires_in: expires_in_refresh
        };
        return res.status(200).json({
          bearerToken: bearerToken,
          refreshToken: refreshToken
        });
      }
    })
    .catch(error => {
      res.status(500).json({
        error: true,
        message: "Internal Server Error"
      });
    });
});

router.post('/register', function (req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      error: true,
      message: "Request body incomplete - email and password needed"
    });
    return;
  }

  const queryUsers = req.db.from("users").select("*").where("email", "=", email);
  queryUsers
    .then(users => {
      if (users.length > 0) {
        res.status(409).json({ success: true, message: "User already exists" });
        return;
      }

      const saltRounds = 10;
      const hash = bcrypt.hashSync(password, saltRounds);
      return req.db.from("users").insert({ email, hash });
    })
    .then(() => {
      res.status(201).json({ success: true, message: "User created" });
    })
    .catch(e => {
      res.status(500).json({ success: false, message: "Error in MySQL query" });
    });
});

router.get('/:email/profile', authorization, function (req, res, next) {
  const filter = { "email": req.params.email };

  req.db('users').where(filter)
    .select(
      "email",
      "firstName",
      "lastName",
      "dob",
      "address"
    )
    .then((rows) => {
      if (rows.length === 0) {
        return res.status(404).json({ error: true, message: "User not found" });
      }
      const movie = rows[0];

      if (req.headers.authorization) {
        const decodedToken = jwt.decode(req.headers.authorization.replace(/^Bearer /, ""));
        const loggedInUserEmail = decodedToken.email;

        if (!req.headers.authorization.match(/^Bearer /)) {
          res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
          return;
        }

        if (loggedInUserEmail === req.params.email) {
          return res.status(200).json({
            email: movie.email,
            firstName: movie.firstName,
            lastName: movie.lastName,
            dob: movie.dob,
            address: movie.address
          });
        } else {
          return res.status(200).json({
            email: movie.email,
            firstName: movie.firstName,
            lastName: movie.lastName
          });
        }
      } else {
        return res.status(200).json({
          email: movie.email,
          firstName: movie.firstName,
          lastName: movie.lastName
        });
      }
    })
    .catch((e) => {
      if (e.name === "TokenExpiredError") {
        res.status(401).json({ error: true, message: "JWT token has expired" });
      } else {
        res.status(401).json({ error: true, message: "Invalid JWT token" });
      }
    })
});

router.put('/:email/profile', authorization, (req, res, next) => {
  if (!("authorization" in req.headers) || !req.headers.authorization.match(/^Bearer /)) {
    res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
    return;
  }

  const token = req.headers.authorization.replace(/^Bearer /, "");
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      res.status(401).json({ error: true, message: "JWT token has expired" });
    } else {
      res.status(401).json({ error: true, message: "Invalid JWT token" });
    }
    return;
  }

  if (!req.body.firstName || !req.body.lastName || !req.body.dob || !req.body.address) {
    res.status(400).json({ error: true, message: "Request body incomplete: firstName, lastName, dob and address are required." });
    return;
  } else if (typeof req.body.firstName !== "string" || typeof req.body.lastName !== "string" || typeof req.body.address !== "string") {
    res.status(400).json({ error: true, message: "Request body invalid: firstName, lastName and address must be strings only." });
    return;
  }

  const dob = req.body.dob;
  const dobDate = new Date(dob);

  if (isNaN(dobDate) || dobDate.toISOString().slice(0, 10) !== dob) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a real date in format YYYY-MM-DD." });
    return;
  }

  const currentDate = new Date();
  if (dobDate > currentDate) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a date in the past." });
    return;
  }

  if (req.headers.authorization) {
    const decodedToken = jwt.decode(req.headers.authorization.replace(/^Bearer /, ""));
    const loggedInUserEmail = decodedToken.email;

    if (loggedInUserEmail !== req.params.email) {
      res.status(403).json({ error: true, message: "Forbidden" });
      return;
    }

    const filter = { "email": req.params.email };
    const profile = {
      "firstName": req.body.firstName,
      "lastName": req.body.lastName,
      "dob": dob,
      "address": req.body.address
    };

    req.db('users').where(filter).update(profile)
      .then(() => {
        return res.status(200).json({
          email: req.params.email,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          dob: req.body.dob,
          address: req.body.address
        });
      }).catch(error => {
        console.log(error)
        res.status(500).json({ message: 'Error in MySQL query' });
      })
  } else {
    return res.status(500).json({ message: 'Error in MySQL query' });
  }
});

module.exports = router;
