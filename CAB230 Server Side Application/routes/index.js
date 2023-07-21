const { parse } = require('dotenv');
const { query } = require('express');
var express = require('express');
var router = express.Router();

const authorization = require("../middleware/authorization");

router.get("/movies/search", function (req, res, next) {
  var page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const offset = (page - 1)

  let query = req.db.from("basics").select(
    "primaryTitle AS title",
    "tconst AS imdbID",
    "year",
    "imdbRating",
    "rottentomatoesRating AS rottenTomatoesRating",
    "metacriticRating",
    "rated AS classification"
  );
  query
  
  if (req.query.title) {
    query = query.where("primaryTitle", "LIKE", `%${req.query.title}%`);
  }
  if (req.query.page) {
    page = req.query.page;
  }
  if (req.query.year && isNaN(req.query.year)) {
    res.status(400).json({ Error: true, message: "Invalid year format. Format must be yyyy." });
    return;
  }
  if (page && isNaN(page)) {
    res.status(400).json({ Error: true, message: "Invalid page format. page must be a number." });
    return;
  }
  if (req.query.year) {
    query = query.where("year", req.query.year);
  }
  query
    .then((rows) => {
      rows.forEach((row) => {
        row.imdbRating = parseFloat(row.imdbRating);
        row.rottenTomatoesRating = parseFloat(row.rottenTomatoesRating);
        row.metacriticRating = parseFloat(row.metacriticRating);
      })
      const totalCount = rows.length;
      const paginatedRows = rows.slice(offset * limit, offset * limit + limit);
      const pagination = {
        total: totalCount,
        lastPage: Math.ceil(totalCount / limit),
        prevPage: offset > 0 ? offset : null,
        nextPage: offset < Math.ceil(totalCount / limit) - 1 ? offset + 2 : null,
        perPage: limit,
        currentPage: offset + 1,
        from: offset * limit,
        to: offset * limit + paginatedRows.length,
      };

      res.json({
        Error: false,
        Message: "Success",
        data: paginatedRows,
        pagination: pagination,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ Error: true, Message: "Error in MySQL query" });
    });
});


router.get("/movies/data/:imdbID", function (req, res, next) {
  if (Object.keys(req.query).length > 0) {
    return res.status(400).json({
      error: true,
      message: "Query parameters are not permitted.",
    });
  }
  req.db
    .from("basics")
    .select(
      "primaryTitle AS title",
      "year",
      "runtimeMinutes",
      "genres",
      "country",
      "imdbRating",
    "rottentomatoesRating",
    "metacriticRating",

      "boxoffice",
      "poster",
      "plot"
    )
    .where("tconst", "=", req.params.imdbID)
    .then((rows) => {
      if (rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No record exists of a movie with this ID",
        });
      }
      if (rows.length > 0) {
        const movie = rows[0];
        movie.imdbRating = parseFloat(movie.imdbRating);
        movie.rottentomatoesRating = parseFloat(movie.rottentomatoesRating);
        movie.metacriticRating = parseFloat(movie.metacriticRating);
        const ratings = [
          { source: "Internet Movie Database", value: rows[0].imdbRating },
          { source: "Rotten Tomatoes", value: rows[0].rottentomatoesRating },
          { source: "Metacritic", value: rows[0].metacriticRating },
        ];
        req.db
          .from("principals")
          .select(
            "nconst AS id",
            "category",
            "name",
            "characters"
          )
          .where("tconst", "=", req.params.imdbID)
          .limit(10)
          .then((rows) => {
            rows.forEach((row) => {
              let characters;
              try {
                characters = JSON.parse(row.characters);
              } catch (error) {
                characters = [];
              }
              row.characters = Array.isArray(characters) ? characters : [];
            });
          
            res.status(200).json({
              title: movie.title,
              year: movie.year,
              runtime: movie.runtimeMinutes,
              genres: movie.genres ? movie.genres.split(",") : [],
              country: movie.country,
              principals: rows,
              ratings: ratings,
              boxoffice: movie.boxoffice,
              poster: movie.poster,
              plot: movie.plot,
            });
          })
          .catch((err) => {
            console.log(err);
            res.status(500).json({ Error: true, Message: "Error in MySQL query" });
          });
      }
    })
    .catch((err) => {
      console.log(err);
      res.json({ Error: true, Message: "Error in MySQL query" });
    });
});

router.get("/people/:id", authorization, (req, res, next) => {
  if (!req.params.id || !req.params.id.match(/^nm\d+$/)) {
    return res.status(404).json({
      error: true,
      message: "Invalid or missing 'imdbID' parameter"
    });
  }
  if (Object.keys(req.query).length > 0) {
    return res.status(400).json({
      error: true,
      message: "Query parameters are not permitted."
    });
  }

  req.db
    .from("names")
    .select(
      "primaryName AS name",
      "birthYear",
      "deathYear",
    )
    .where("nconst", "=", req.params.id)
    .then((rows) => {
      if (rows.length > 0) {
        const movie = rows[0];

        req.db
          .from("principals")
          .select(
            "basics.primaryTitle AS movieName",
            "principals.tconst AS movieId",
            "principals.category",
            "characters",
            "imdbRating"
          )
          .where("principals.nconst", "=", req.params.id)
          .leftJoin("basics", "principals.tconst", "basics.tconst")
          .then((rows) => {
            rows.forEach((row) => {
              row.imdbRating = parseFloat(row.imdbRating);
              let characters;
              try {
                characters = JSON.parse(row.characters);
              } catch (error) {
                characters = [];
              }
              row.characters = Array.isArray(characters) ? characters : [];
            });
            res.status(200).json({
              name: movie.name,
              birthYear: movie.birthYear,
              deathYear: movie.deathYear,
              roles: rows,
            });
          })
          .catch((err) => {
            console.log(err);
            res.status(500).json({ Error: true, Message: "Error in MySQL query" });
          });
      }
      else {
        res.status(404).json({ Error: true, Message: "Person not found" });
      }
    });
});

module.exports = router;
