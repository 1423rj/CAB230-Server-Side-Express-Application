# CAB230-Server-Side-Express-Application
 Webcomputing - CAB230. Server

# React Server Application - README

This is the README file for a React server application. The application uses Express.js as the backend framework and implements various routes for user authentication and movie data retrieval. Below are the details of each file and its functionalities.

## user.js

This file contains the route handlers for user-related functionalities, including user login, registration, profile management, and token handling.

### Route: `GET /users`

- Description: Responds with a simple message indicating the presence of user resources.

### Route: `POST /users/refresh`

- Description: Refreshes the user's access token and provides a new access token and refresh token pair.
- Middleware: Requires authorization using the access token (Bearer token).

### Route: `POST /users/logout`

- Description: Invalidates the refresh token provided, preventing its future use.
- Middleware: Requires authorization using the access token (Bearer token).

### Route: `POST /users/login`

- Description: Allows a user to log in by providing email and password. Generates access and refresh tokens upon successful login.

### Route: `POST /users/register`

- Description: Registers a new user by providing email and password.

### Route: `GET /users/:email/profile`

- Description: Retrieves the user's profile details based on the provided email.
- Middleware: Requires authorization using the access token (Bearer token).

### Route: `PUT /users/:email/profile`

- Description: Updates the user's profile details based on the provided email.
- Middleware: Requires authorization using the access token (Bearer token).
- Example Request Body: 
  ```json
  {
    "firstName": "<new_first_name>",
    "lastName": "<new_last_name>",
    "dob": "<new_date_of_birth>",
    "address": "<new_address>"
  }

## index.js

This file contains the route handlers for movie data retrieval functionalities.

### Route: `GET /movies/search`

- Description: Searches for movies based on optional query parameters such as title and year.
- Example Request: `/movies/search?title=<movie_title>&year=<movie_year>&page=<page_number>&limit=<movies_per_page>`

### Route: `GET /movies/data/:imdbID`

- Description: Retrieves detailed data for a movie based on its IMDb ID.

### Route: `GET /people/:id`

- Description: Retrieves details of a person based on their IMDb ID.
- Middleware: Requires authorization using the access token (Bearer token).