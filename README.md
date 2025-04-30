# NexusOps - Backend Documentation

This document provides comprehensive documentation for the backend system of the NexusOps company management application. It covers requirements, setup, API endpoints, core utilities, database schema, security considerations, and testing procedures.

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. High-Level Architecture](#2-high-level-architecture)
- [3. Requirements](#3-requirements)
  - [3.1 Runtime Environment](#31-runtime-environment)
  - [3.2 Dependencies](#32-dependencies)
  - [3.3 Development Dependencies](#33-development-dependencies)
  - [3.4 Environment Variables](#34-environment-variables)
- [4. Setup and Running](#4-setup-and-running)
- [5. Core Libraries & Utilities (`/lib`)](#5-core-libraries--utilities-lib)
  - [5.1 `lib/postgres.ts`](#51-libpostgrests)
  - [5.2 `lib/supabase.ts`](#52-libsupabasets)
  - [5.3 `lib/utils.ts`](#53-libutilsts)
  - [5.4 `lib/roles.ts`](#54-librolests)
  - [5.5 `lib/constants.ts`](#55-libconstantsts)
- [6. Role Permissions Summary](#6-role-permissions-summary)
- [7. API Routes](#7-api-routes)
  - [7.1 Authentication (`/auth`)](#71-authentication-auth)
    - [POST /auth/sign-up/company](#post-authsign-upcompany)
    - [POST /auth/sign-up/employee](#post-authsign-upemployee)
    - [POST /auth/sign-in](#post-authsign-in)
    - [POST /auth/sign-out](#post-authsign-out)
    - [GET /auth/user](#get-authuser)
  - [7.2 Tickets (`/ticket`)](#72-tickets-ticket)
    - [POST /ticket](#post-ticket)
    - [GET /ticket/all](#get-ticketall)
    - [GET /ticket/:id](#get-ticketid)
    - [PATCH /ticket/:id/status](#patch-ticketidstatus)
    - [POST /ticket/:id/response](#post-ticketidresponse)
    - [GET /ticket/:id/responses](#get-ticketidresponses)
  - [7.3 Schedule (`/schedule`)](#73-schedule-schedule)
    - [GET /schedule](#get-schedule)
    - [GET /schedule/details/:hourDay](#get-scheduledetailshourday)
    - [POST /schedule](#post-schedule)
    - [GET /schedule/users](#get-scheduleusers)
    - [PATCH /schedule/finalize](#patch-schedulefinalize)
    - [DELETE /schedule](#delete-schedule)
    - [PATCH /schedule/update/:id](#patch-scheduleupdateid)
  - [7.4 Training (`/training`)](#74-training-training)
    - [GET /training](#get-training)
    - [GET /training/results](#get-trainingresults)
    - [GET /training/test/:testId](#get-trainingtesttestid)
    - [POST /training](#post-training)
    - [POST /training/start/:testId](#post-trainingstarttestid)
    - [POST /training/submission/:testId](#post-trainingsubmissiontestid)
  - [7.5 Company (`/company`)](#75-company-company)
    - [PATCH /company/name](#patch-companyname)
  - [7.6 User (`/user`)](#76-user-user)
    - [POST /user/avatar](#post-useravatar)
- [8. Database Schema](#8-database-schema)
  - [8.1 Entity-Relationship Diagram (ERD)](#81-entity-relationship-diagram-erd)
  - [8.2 Schema Overview](#82-schema-overview)
  - [8.3 Table Details](#83-table-details)
  - [8.4 Database Triggers](#84-database-triggers)
- [9. Error Handling](#9-error-handling)
- [10. Security Considerations](#10-security-considerations)
- [11. Testing](#11-testing)
  - [11.1 Requirements for Testing](#111-requirements-for-testing)
  - [11.2 Running Tests](#112-running-tests)
  - [11.3 Test Files and Coverage](#113-test-files-and-coverage)
- [12. Future Development / TODOs](#12-future-development--todos)

## 1. Introduction

This document details the backend system for the **NexusOps** company management application. It provides essential information for developers regarding setup, requirements, the API structure, core logic, database design, and testing procedures.

## 2. High-Level Architecture

The backend follows a standard web service architecture consisting of a client frontend, the Express backend application, a PostgreSQL database for primary data storage, and Supabase for handling authentication and file storage.

* **Client/Frontend:** Interacts with the backend via REST API calls.
* **NexusOps Express Backend:** The core application built with Express.js, handling business logic, API routing, database interaction, and authentication orchestration.
* **PostgreSQL DB:** The primary data store, managed via Supabase but interacted with directly using the `pg` library.
* **Supabase:** Used for Authentication (user management, JWT handling) and Storage (avatars, training files).

## 3. Requirements

### 3.1 Runtime Environment

* **Node.js / Bun:** The backend is developed using TypeScript and can be run with either Node.js or Bun.
* **TypeScript:** Version ^5.0.0 or compatible.

### 3.2 Dependencies

| Package                 | Version      | Description                                           |
|:------------------------|:-------------|:------------------------------------------------------|
| `express`               | ^4.21.2      | Web server framework                                  |
| `cors`                  | ^2.8.5       | Middleware for enabling Cross-Origin Resource Sharing |
| `cookie-parser`         | ^1.4.7       | Middleware for parsing request cookies                |
| `@supabase/supabase-js` | ^2.48.1      | Supabase client library (Auth, Storage)               |
| `pg`                    | ^8.13.1      | PostgreSQL client library for Node.js                 |
| `zod`                   | ^3.24.1      | Schema declaration and validation library             |
| `multer`                | ^1.4.5-lts.2 | Middleware for handling multipart/form-data           |

### 3.3 Development Dependencies

| Package      | Version | Description                    |
|:-------------|:--------|:-------------------------------|
| `vitest`     | ^3.1.1  | Test runner framework          |
| `supertest`  | ^7.1.0  | HTTP assertion testing library |
| `dotenv`     | ^16.5.0 | Loading environment variables  |
| `@types/*`   | Various | TypeScript type definitions    |
| `@types/bun` | ^1.2.9  | Bun-specific types             |

### 3.4 Environment Variables

These variables must be configured (typically in a `.env` file):

| Variable                    | Description                                             | Example                                   |
|:----------------------------|:--------------------------------------------------------|:------------------------------------------|
| `SUPABASE_URL`              | Your Supabase project URL.                              | `https://your-project-ref.supabase.co`    |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (for admin operations).  | `eyJ...`                                  |
| `POSTGRES_URL`              | Connection string for your PostgreSQL database.         | `postgresql://user:password@host:port/db` |
| `ORIGIN_URL`                | The frontend URL for CORS configuration.                | `http://localhost:5173`                   |
| `PORT` (Optional)           | The port the server should run on (defaults to `3000`). | `8080`                                    |

*Note: For testing, a separate `.env.test` file is loaded, pointing to a local test database.*

## 4. Setup and Running

1.  **Clone:** Get the repository code.
2.  **Install:** Run `bun install` or `npm install`.
3.  **Environment:** Create a `.env` file and populate the [Environment Variables](#34-environment-variables).
4.  **Database:** Ensure PostgreSQL is running and the schema is applied using the migrations in `/supabase/migrations`. Use `supabase db reset --local` for local development/testing resets.
5.  **Run:** Execute `bun run dev` to start the development server with hot-reloading. Access it at `http://localhost:3000` (or your configured `PORT`).

## 5. Core Libraries & Utilities (`/lib`)

This directory contains essential modules used across the application.

### 5.1 `lib/postgres.ts`

* Initializes and exports a singleton `pg.Pool` instance for connecting to the PostgreSQL database specified by `POSTGRES_URL`.
* This pool is imported by route files to execute SQL queries against the main application database.

### 5.2 `lib/supabase.ts`

* Initializes and exports the Supabase JavaScript client (`@supabase/supabase-js`).
* Configured with `SUPABASE_URL` and the `SUPABASE_SERVICE_ROLE_KEY` for backend operations requiring elevated privileges (like admin user creation/deletion, admin sign-out, potentially bypassing RLS for specific tasks).
* Used primarily in [`/routes/auth.ts`](#71-authentication-auth) for authentication flows and in [`/routes/training.ts`](#74-training-training) and [`/routes/user.ts`](#76-user-user) for interacting with Supabase Storage.

### 5.3 `lib/utils.ts`

* Contains helper functions, most notably:
  * **`getUserFromCookie(req, res, next)`**: An Express middleware crucial for authentication across protected routes.
    1.  Parses `auth` (access token) and `refresh` (refresh token) cookies from the request (`req.cookies`) using Zod for basic validation.
    2.  **If `auth` token exists:** Validates it using `supabase.auth.getUser(token)`.
    3.  **If `auth` token is missing/invalid BUT `refresh` token exists:** Attempts to refresh the session using `supabase.auth.refreshSession({ refresh_token })`. If successful, sets new `auth` and `refresh` cookies on the response (`res`) with appropriate expiry times based on the new session.
    4.  **If authentication succeeds (either initially or via refresh):** Attaches the validated Supabase `user` object to `req.user` and the current `access_token` to `req.token`. Calls `next()` to proceed to the route handler.
    5.  **If authentication fails:** Sends a `401 Unauthorized` JSON response and clears potentially invalid `auth` and `refresh` cookies from the client.

### 5.4 `lib/roles.ts`

* Defines the Role-Based Access Control (RBAC) logic.
* **`UserRole` Enum:** Defines numeric values for user roles (Employee=1, Leader=2, Owner=3, Admin=4). See [`types/database.ts`](#83-table-details).
* **`Permissions` Interface:** Defines the structure for permission checks across different resources (`tickets`, `schedule`, `training`, `submission`, `company`). Specifies the expected `dataType` for context and the possible `action` strings.
* **`ROLES` Constant:** A nested configuration object defining specific permission rules for each `UserRole` against each `resource` and `action`. Permissions can be:
  * `boolean`: Simple grant (`true`) or deny (`false`).
  * `function(user, data)`: A function evaluated dynamically at runtime based on the authenticated `user` performing the action and contextual `data` about the target resource (e.g., checking if `user.id === data.userId` for ownership, or if `user.user_metadata.company_id === data.companyId` for company association).
* **`hasPermission(user, resource, action, data)`:** The core authorization function used by API routes. It retrieves the relevant permission rule from the `ROLES` constant based on the user's role (`user.user_metadata.role`) and the requested resource/action. It then evaluates the rule, returning `true` if access is granted, `false` otherwise. See the [Role Permissions Summary](#6-role-permissions-summary) table for a detailed breakdown.

### 5.5 `lib/constants.ts`

* Defines shared constants, primarily cookie configurations.
* **`COOKIE_OPTIONS` / `REFRESH_COOKIE_OPTIONS`**: Pre-configured options objects passed to Express `res.cookie()`. Sets security flags like `httpOnly: true` (prevents client-side script access), `secure: true` (sent only over HTTPS), and `sameSite: 'none'` (necessary for cross-site contexts, requires `secure: true`). `REFRESH_COOKIE_OPTIONS` also includes a `maxAge` of 7 days.

## 6. Role Permissions Summary

The following table summarizes the access control rules enforced by the `hasPermission` function in [`lib/roles.ts`](#54-librolests), based on the user's role.

| Resource       | Action       | Employee (`Role 1`)                                       | Leader (`Role 2`)                                               | Owner (`Role 3`)                  | Admin (`Role 4`)                         | Notes                                                               |
|:---------------|:-------------|:----------------------------------------------------------|:----------------------------------------------------------------|:----------------------------------|:-----------------------------------------|:--------------------------------------------------------------------|
| **Ticket**     | `view`       | ✅ Own Only (`data.userId`)                                | ✅ Own or Company (`data.userId`, `data.companyId`)              | ✅ Own or Company                  | ✅ Admin Only (`data.companyId === null`) |                                                                     |
|                | `create`     | ✅ Company or Admin (`data.companyId`)                     | ✅ Company or Admin                                              | ✅ Company or Admin                | ❌                                        |                                                                     |
|                | `delete`     | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ✅ Admin Only                             |                                                                     |
|                | `close`      | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ✅ Admin Only                             |                                                                     |
|                | `respond`    | ✅ Own Only (`data.userId`)                                | ✅ Own or Company                                                | ✅ Own or Company                  | ✅ Admin Only                             |                                                                     |
| **Schedule**   | `view`       | ✅ Own Only (`data.userId`)                                | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `create`     | ✅ Own Only (`data.userId`)                                | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        | Leader cannot create for Owner (enforced in route).                 |
|                | `finalize`   | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `delete`     | ✅ Own & Not Finalized (`data.userId`, `!data.finalized`)  | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        | Leader/Owner can delete finalized schedules.                        |
|                | `update`     | ✅ Own & Not Finalized (`data.userId`, `!data.finalized`)  | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        | Leader/Owner can update finalized schedules.                        |
| **Training**   | `view`       | ✅ Employee Role & Company (`data.role`, `data.companyId`) | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `create`     | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `delete`     | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `update`     | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
| **Submission** | `view`       | ✅ Own Only (`data.userId`)                                | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        |                                                                     |
|                | `create`     | ✅ Employee Role & Company (`data.role`, `data.companyId`) | ✅ Company Only (`data.companyId`)                               | ✅ Company Only                    | ❌                                        | User can submit for any training role they have permission to view. |
| **Company**    | `updateName` | ❌                                                         | ❌                                                               | ✅ Company Only (`data.companyId`) | ❌                                        |                                                                     |
|                | `updateLogo` | ❌                                                         | ❌                                                               | ✅ Company Only (`data.companyId`) | ❌                                        | *Note: Logo update route not yet implemented.*                      |
|                | `view`       | ✅ Own Only (`data.userId`)                                | ✅ Company Only & (Role<=Leader) (`data.companyId`, `data.role`) | ✅ Company Only (`data.companyId`) | ❌                                        | View refers to viewing user data within the company context.        |
|                | `verify`     | ❌                                                         | ✅ Company Only (`data.companyId`)                               | ✅ Company Only (`data.companyId`) | ❌                                        | Verify refers to verifying a user account.                          |
|                | `update`     | ❌                                                         | ❌                                                               | ✅ Company Only (`data.companyId`) | ❌                                        | Update refers to modifying user role/wage.                          |

*(data refers to the contextual data object passed to hasPermission, e.g., { companyId: '...', role: 1, userId: '...' })*

## 7. API Routes

All routes are prefixed based on their file name (e.g., `/auth`, `/ticket`). They generally consume and produce JSON. Authentication relies on `auth` and `refresh` cookies processed by the [`getUserFromCookie`](#53-libutilsts) middleware. Standard HTTP status codes are used for responses (see [Error Handling](#9-error-handling)).

---

### 7.1 Authentication (`/auth`)

Handles user lifecycle and session management via Supabase Auth. Found in `routes/auth.ts`.

#### `POST /auth/sign-up/company`

* **Description:** Registers a new company and its initial Owner user.
* **Permissions:** Public (No authentication required).
* **Request Body Example:**
    ```json
    {
      "name": "Alice Smith",
      "email": "alice@examplecorp.com",
      "password": "strooooOOong123:D!",
      "company_name": "Example Corp"
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/auth/sign-up/company \
         -H "Content-Type: application/json" \
         -d '{ "name": "Alice Smith", "email": "alice@examplecorp.com", "password": "strooooOOong123:D!", "company_name": "Example Corp" }'
    ```
* **Success Response (201 Created):**
    ```json
    {
      "status": "success",
      "message": "Signed up successfully."
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                                 | Example Response Body                                                                                            |
  |:------------|:----------------------------------------|:-----------------------------------------------------------------------------------------------------------------|
  | `422`       | Validation Error (Zod schema failed)    | `{"status": "error", "message": "Invalid credentials provided.", "errors": {"fieldErrors": {"email": ["..."]}}}` |
  | `422`       | Email already exists (from Supabase)    | `{"status": "error", "message": "Failed to sign up.", "errors": {"email": "Email is already in use"}}`           |
  | `500`       | Database error creating company or user | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`                              |

#### `POST /auth/sign-up/employee`

* **Description:** Registers a new employee user for an existing company.
* **Permissions:** Public.
* **Request Body Example:**
    ```json
    {
      "name": "Bob Johnson",
      "email": "bob@examplecorp.com",
      "password": "evenStronger:I",
      "company_code": "VALID8CD"
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/auth/sign-up/employee \
         -H "Content-Type: application/json" \
         -d '{ "name": "Bob Johnson", "email": "bob@examplecorp.com", "password": "evenStronger:I", "company_code": "VALID8CD" }'
    ```
* **Success Response (201 Created):**
    ```json
    {
      "status": "success",
      "message": "Signed up successfully."
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                              | Example Response Body                                                                                                   |
  |:------------|:-------------------------------------|:------------------------------------------------------------------------------------------------------------------------|
  | `422`       | Validation Error (Zod schema failed) | `{"status": "error", "message": "Invalid credentials provided.", "errors": {"fieldErrors": {"company_code": ["..."]}}}` |
  | `404`       | Invalid `company_code`               | `{"status": "error", "message": "Failed to sign up.", "errors": {"company_code": "Invalid company code"}}`              |
  | `422`       | Email already exists (from Supabase) | `{"status": "error", "message": "Failed to sign up.", "errors": {"email": "Email is already in use"}}`                  |
  | `500`       | Database error creating user         | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`                                     |

#### `POST /auth/sign-in`

* **Description:** Authenticates a user with email and password.
* **Permissions:** Public.
* **Request Body Example:**
    ```json
    {
      "email": "bob@examplecorp.com",
      "password": "S3CuREE2?"
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/auth/sign-in \
         -H "Content-Type: application/json" \
         -d '{ "email": "bob@examplecorp.com", "password": "S3CuREE2?" }'
    ```
* **Success Response (200 OK):**
  * Sets `auth` (access token) and `refresh` (refresh token) HTTP-only cookies.
    ```json
    {
      "status": "success",
      "message": "Signed in successfully."
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                              | Example Response Body                                                                                                                 |
  |:------------|:-------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------|
  | `422`       | Validation Error (Zod schema failed) | `{"status": "error", "message": "Invalid credentials provided.", "errors": {"fieldErrors": {"email": ["Email address is invalid"]}}}` |
  | `400`       | Invalid Credentials (from Supabase)  | `{"status": "error", "message": "Failed to sign in.", "errors": {"email": "Invalid credentials", "password": "Invalid credentials"}}` |
  | `500`       | Unexpected Supabase or server error  | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`                                                   |

#### `POST /auth/sign-out`

* **Description:** Signs the user out by invalidating the session token and clearing cookies.
* **Permissions:** Authenticated User (Requires valid `auth` cookie).
* **Request Body:** None.
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/auth/sign-out \
         -H "Cookie: auth=VALID_ACCESS_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
  * Clears `auth` and `refresh` cookies via `Set-Cookie` headers with past expiry.
    ```json
    {
      "status": "success",
      "message": "Signed out successfully."
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                             | Example Response Body                                                               |
  |:------------|:------------------------------------|:------------------------------------------------------------------------------------|
  | `401`       | No/Invalid `auth` cookie provided   | (Handled by `getUserFromCookie` middleware, see [Utils](#53-libutilsts))            |
  | `500`       | Unexpected Supabase or server error | `{"status": "error", "message": "There was an unexpected error. Try again later!"}` |

#### `GET /auth/user`

* **Description:** Fetches the details of the currently authenticated user. Handles token refresh automatically via middleware if needed.
* **Permissions:** Authenticated User (Requires valid `auth` or `refresh` cookie).
* **Request Body:** None.
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/auth/user \
         -H "Cookie: auth=VALID_ACCESS_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
  * May set new `auth`/`refresh` cookies if token refresh occurred.
    ```json
    {
      "status": "success",
      "message": "Successfully authenticated user",
      "data": {
        "id": "f0744a3b-71d4-4d96-9e70-b2f3d4acb727",
        "name": "Bob Johnson",
        "age": 20,
        "hourly_wage": null,
        "role": 1,
        "company_id": "1504096a-8db2-40f2-8a65-8b342adb7dd8",
        "verified": true,
        "created_at": "2025-05-01T08:30:00.000Z",
        "avatar_url": null
      }
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                                       | Example Response Body                                                               |
  |:------------|:----------------------------------------------|:------------------------------------------------------------------------------------|
  | `401`       | No/Invalid `auth` or `refresh` cookie         | (Handled by `getUserFromCookie` middleware, see [Utils](#53-libutilsts))            |
  | `500`       | Database error fetching user data or Supabase | `{"status": "error", "message": "There was an unexpected error. Try again later!"}` |

---

### 7.2 Tickets (`/ticket`)

Manages support tickets and responses. Found in `routes/ticket.ts`. Access control uses [`hasPermission`](#54-librolests).

#### `POST /ticket`

* **Description:** Creates a new support ticket.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:create`).
* **Request Body Example:**
    ```json
    {
      "title": "Cannot Access Schedule",
      "content": "The schedule page shows an error when I try to load it.",
      "company_id": "1504096a-8db2-40f2-8a65-8b342adb7dd8"
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/ticket \
         -H "Content-Type: application/json" \
         -H "Cookie: auth=VALID_TOKEN_HERE" \
         -d '{ "title": "Cannot Access Schedule", "content": "The schedule page shows an error when I try to load it.", "company_id": "1504096a-8db2-40f2-8a65-8b342adb7dd8" }'
    ```
* **Success Response (201 Created):**
    ```json
    {
      "status": "success",
      "message": "Ticket created successfully!"
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                                             | Example Response Body                                                               |
  |:------------|:----------------------------------------------------|:------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                                   | (Handled by `getUserFromCookie`)                                                    |
  | `400`       | Validation Error (Zod schema: title/content length) | `{"status": "error", "message": "Invalid data! Please check the fields."}`          |
  | `403`       | Permission Denied                                   | `{"status": "error", "message": "You are not authorized to create a ticket!"}`      |
  | `500`       | Database error                                      | `{"status": "error", "message": "There was an unexpected error. Try again later!"}` |

#### `GET /ticket/all`

* **Description:** Retrieves tickets accessible to the user based on role.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:view`).
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/ticket/all -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Tickets fetched successfully!",
      "data": [ /* Array of Ticket objects */ ]
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                        | Example Response Body                                                                 |
  |:------------|:-------------------------------|:--------------------------------------------------------------------------------------|
  | `401`       | Not authenticated              | (Handled by `getUserFromCookie`)                                                      |
  | `404`       | No tickets found or accessible | `{"status": "error", "message": "Tickets not found or you don't have permission..."}` |
  | `500`       | Database error                 | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`   |

#### `GET /ticket/:id`

* **Description:** Retrieves details for a single ticket.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:view`).
* **Query Parameters:** `include_responses` (optional).
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/ticket/TICKET_UUID_HERE?include_responses -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Ticket fetched successfully!",
      "data": { /* Ticket object, potentially with 'responses' array */ }
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                               | Example Response Body                                                                |
  |:------------|:--------------------------------------|:-------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                     | (Handled by `getUserFromCookie`)                                                     |
  | `404`       | Ticket not found or permission denied | `{"status": "error", "message": "Ticket not found or you don't have permission..."}` |
  | `500`       | Database error                        | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`  |

#### `PATCH /ticket/:id/status`

* **Description:** Toggles the `closed` status of a ticket.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:close`).
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/ticket/TICKET_UUID_HERE/status -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "Ticket status updated successfully!" }
    ```
* **Error Responses:**

  | Status Code | Meaning                          | Example Response Body                                                                |
  |:------------|:---------------------------------|:-------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                | (Handled by `getUserFromCookie`)                                                     |
  | `403`       | Permission Denied                | `{"status": "error", "message": "You are not authorized to close this ticket!"}`     |
  | `404`       | Ticket not found or inaccessible | `{"status": "error", "message": "Ticket not found or you don't have permission..."}` |
  | `500`       | Database error                   | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`  |

#### `POST /ticket/:id/response`

* **Description:** Adds a response to a ticket.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:respond`).
* **Request Body Example:**
    ```json
    { "content": "This issue has been resolved." }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/ticket/TICKET_UUID_HERE/response \
         -H "Content-Type: application/json" \
         -H "Cookie: auth=VALID_TOKEN_HERE" \
         -d '{ "content": "This issue has been resolved." }'
    ```
* **Success Response (201 Created):**
    ```json
    { "status": "success", "message": "Response added successfully!" }
    ```
* **Error Responses:**

  | Status Code | Meaning                           | Example Response Body                                                                 |
  |:------------|:----------------------------------|:--------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                 | (Handled by `getUserFromCookie`)                                                      |
  | `400`       | Validation Error (content length) | `{"status": "error", "message": "Invalid data! Please check the fields."}`            |
  | `403`       | Permission Denied                 | `{"status": "error", "message": "You are not authorized to respond to this ticket!"}` |
  | `404`       | Ticket not found or inaccessible  | `{"status": "error", "message": "Ticket not found or you don't have permission..."}`  |
  | `500`       | Database error                    | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`   |

#### `GET /ticket/:id/responses`

* **Description:** Retrieves all responses for a ticket.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `tickets:view`).
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/ticket/TICKET_UUID_HERE/responses -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Ticket responses fetched successfully!",
      "data": [ /* Array of Ticket Response objects, joined with user name */ ]
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                               | Example Response Body                                                                |
  |:------------|:--------------------------------------|:-------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                     | (Handled by `getUserFromCookie`)                                                     |
  | `404`       | Ticket not found or permission denied | `{"status": "error", "message": "Ticket not found or you don't have permission..."}` |
  | `500`       | Database error                        | `{"status": "error", "message": "There was an unexpected error. Try again later!"}`  |

---

### 7.3 Schedule (`/schedule`)

Manages work schedules. Found in `routes/schedule.ts`. Includes validation for overlaps, rest periods, max hours, and age restrictions. Uses [`hasPermission`](#54-librolests).

#### `GET /schedule`

* **Description:** Fetches schedule data for a week, aggregated for calendar view.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `schedule:view`). Filters results.
* **Query Parameters:** `weekStart` (optional `YYYY-MM-DD`), `category` (optional `1` or `2`).
* **`curl` Example:**
    ```bash
    curl -X GET "http://localhost:3000/schedule?weekStart=2025-05-05" -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Schedules fetched successfully!",
      "data": {
        "weekStart": "2025-05-05",
        "prevDate": "2025-04-28",
        "nextDate": "2025-05-12",
        "schedule": { "9-0": 1, "10-0": 1, "10-2": 2 /* ... */ }
      }
    }
    ```
* **Error Responses:** See table in previous response section.

#### `GET /schedule/details/:hourDay`

* **Description:** Fetches detailed schedule entries overlapping a specific hour-day slot in a week. Paginated.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `schedule:view`). Filters results.
* **URL Parameters:** `:hourDay` (`HH-D`).
* **Query Parameters:** `weekStart` (optional), `limit` (optional), `page` (optional).
* **`curl` Example:**
    ```bash
    curl -X GET "http://localhost:3000/schedule/details/10-2?weekStart=2025-05-05&page=1" -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Schedules fetched successfully!",
      "data": {
        "schedules": [ /* Array of detailed Schedule objects with user info */ ],
        "pagination": { /* totalPages, currentPage, limit, totalItems */ }
      }
    }
    ```
* **Error Responses:** See table in previous response section.

#### `POST /schedule`

* **Description:** Creates schedule entries. Validates constraints.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `schedule:create`). Role restrictions apply.
* **Request Body Example:**
    ```json
    {
      "start": "2025-05-15T09:00:00.000Z",
      "end": "2025-05-15T17:00:00.000Z",
      "category": 1,
      "companyId": "...",
      "userIds": ["...", "..."]
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/schedule -H "Content-Type: application/json" -H "Cookie: auth=OWNER_TOKEN_HERE" -d '{...}'
    ```
* **Success Response (201 Created or 207 Multi-Status):** See previous response section for examples.
* **Error Responses:** See table in previous response section (includes 400 for validation/constraints, 403 for permissions).

#### `GET /schedule/users`

* **Description:** Fetches users in the company. Paginated.
* **Permissions:** Owner or Leader ([See Table](#6-role-permissions-summary): `schedule:view`).
* **Query Parameters:** `name` (optional), `limit` (optional), `page` (optional).
* **`curl` Example:**
    ```bash
    curl -X GET "http://localhost:3000/schedule/users?name=Smith" -H "Cookie: auth=OWNER_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Users' data fetched successfully!",
      "data": {
        "users": [ /* Array of User objects with basic schedule info */ ],
        "pagination": { /* ... */ }
      }
    }
    ```
* **Error Responses:** See table in previous response section.

#### `PATCH /schedule/finalize`

* **Description:** Marks schedules as finalized.
* **Permissions:** Owner or Leader ([See Table](#6-role-permissions-summary): `schedule:finalize`).
* **Request Body Example:**
    ```json
    { "scheduleIds": ["...", "..."], "finalized": true }
    ```
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/schedule/finalize -H "Content-Type: application/json" -H "Cookie: auth=OWNER_TOKEN_HERE" -d '{...}'
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "Schedules finalized successfully!" }
    ```
* **Error Responses:** See table in previous response section.

#### `DELETE /schedule`

* **Description:** Deletes schedule entries.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `schedule:delete`). Role/status restrictions apply.
* **Request Body Example:**
    ```json
    { "scheduleIds": ["...", "..."] }
    ```
* **`curl` Example:**
    ```bash
    curl -X DELETE http://localhost:3000/schedule -H "Content-Type: application/json" -H "Cookie: auth=VALID_TOKEN_HERE" -d '{...}'
    ```
* **Success Response (200 OK or 207 Multi-Status):** See previous response section for examples.
* **Error Responses:** See table in previous response section (includes 403/404 for permissions/not found).

#### `PATCH /schedule/update/:id`

* **Description:** Modifies the start/end times of a schedule. Validates constraints.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `schedule:update`). Role/status restrictions apply.
* **URL Parameters:** `:id` (Schedule UUID).
* **Request Body Example:**
    ```json
    { "start": "...", "end": "..." }
    ```
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/schedule/update/SCHEDULE_UUID_HERE -H "Content-Type: application/json" -H "Cookie: auth=VALID_TOKEN_HERE" -d '{...}'
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "Schedule updated successfully!" }
    ```
* **Error Responses:** See table in previous response section.

---

### 7.4 Training (`/training`)

Manages training materials, questions, and submissions. Found in `routes/training.ts`. Uses Supabase Storage. Uses [`hasPermission`](#54-librolests).

#### `GET /training`

* **Description:** Fetches available trainings, filtered by role. Indicates user status (active/completed).
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `training:view`).
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/training -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "Trainings fetched successfully!",
      "data": [ /* Array of Training summary objects with 'active'/'completed' flags */ ]
    }
    ```
* **Error Responses:** See table in previous response section.

#### `GET /training/results`

* **Description:** Fetches training submission results (summaries or detailed).
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `submission:view`). Role restrictions apply based on `testId` presence.
* **Query Parameters:** `testId` (optional).
* **`curl` Example:**
    ```bash
    # Summaries (Owner/Leader)
    curl -X GET http://localhost:3000/training/results -H "Cookie: auth=OWNER_TOKEN_HERE"
    # Detailed (Owner/Leader/Employee)
    curl -X GET "http://localhost:3000/training/results?testId=..." -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):** See previous response section for examples of summary and detailed formats.
* **Error Responses:** See table in previous response section.

#### `GET /training/test/:testId`

* **Description:** Fetches training details. Returns questions if active, file URL if inactive.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `training:view`).
* **URL Parameters:** `:testId`.
* **`curl` Example:**
    ```bash
    curl -X GET http://localhost:3000/training/test/TRAINING_UUID_HERE -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):** See previous response section for examples of inactive (with `fileUrl`) and active (with `questions`) formats.
* **Error Responses:** See table in previous response section.

#### `POST /training`

* **Description:** Creates a new training (metadata + file upload). Uses `multipart/form-data`.
* **Permissions:** Owner or Leader ([See Table](#6-role-permissions-summary): `training:create`).
* **Request Body:** `multipart/form-data` with `data` (JSON string) and `file` fields. See previous response section for `data` structure example.
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/training -H "Cookie: auth=OWNER_TOKEN_HERE" -F "data=<training_data.json;type=application/json" -F "file=@training_material.pdf"
    ```
* **Success Response (201 Created):**
    ```json
    { "status": "success", "message": "Training created successfully" }
    ```
* **Error Responses:** See table in previous response section (includes 400 for missing fields, bad JSON, validation, duplicates; 403 for permissions; 500 for upload/DB errors).

#### `POST /training/start/:testId`

* **Description:** Marks a training as "in progress" for the user.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `submission:create`).
* **URL Parameters:** `:testId`.
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/training/start/TRAINING_UUID_HERE -H "Cookie: auth=VALID_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "Training started successfully" }
    ```
* **Error Responses:** See table in previous response section.

#### `POST /training/submission/:testId`

* **Description:** Submits answers for a training. Creates/updates submission, removes "in progress" record.
* **Permissions:** Authenticated User ([See Table](#6-role-permissions-summary): `submission:create`).
* **URL Parameters:** `:testId`.
* **Request Body Example:**
    ```json
    { "id": "TRAINING_UUID_HERE", "questions": [ { "id": "...", "answers": ["..."] } ] }
    ```
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/training/submission/TRAINING_UUID_HERE -H "Content-Type: application/json" -H "Cookie: auth=VALID_TOKEN_HERE" -d '{...}'
    ```
* **Success Response (201 Created):**
    ```json
    { "status": "success", "message": "Submission processed successfully" }
    ```
* **Error Responses:** See table in previous response section.

---

### 7.5 Company (`/company`)

Manages company-level settings. Found in `routes/company.ts`.

#### `PATCH /company/name`

* **Description:** Updates the company name.
* **Permissions:** Owner Only ([See Table](#6-role-permissions-summary): `company:updateName`).
* **Request Body Example:**
    ```json
    { "name": "Nexus Innovations Ltd." }
    ```
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/company/name -H "Content-Type: application/json" -H "Cookie: auth=OWNER_TOKEN_HERE" -d '{ "name": "Nexus Innovations Ltd." }'
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "Company name updated successfully." }
    ```
* **Error Responses:** See table in previous response section.

#### `GET /company/users`

* **Description:** Fetches users within the company, excluding the requesting user and filtering based on role hierarchy (Leaders see Leaders and Employees, Owners see everyone). Supports optional name filtering (case-insensitive, partial match) and optional pagination. If the `page` query parameter is omitted, all matching users are returned.
* **Permissions:** Leader or Owner ([See Table](#6-role-permissions-summary): `company:view`). Employees are denied.
* **Query Parameters:**
  * `name` (optional): Filter users whose name contains the provided string.
  * `page` (optional): Page number to retrieve. If provided (even `page=1`), triggers paginated response. If omitted, returns all matching users.
  * `limit` (optional, default: 20): Number of users per page. Only used if `page` is provided.
* **`curl` Example (Get All):**
    ```bash
    curl -X GET "http://localhost:3000/company/users" \
         -H "Cookie: auth=OWNER_TOKEN_HERE"
    ```
* **`curl` Example (Paginated & Filtered):**
    ```bash
    curl -X GET "http://localhost:3000/company/users?name=Seed&page=1&limit=10" \
         -H "Cookie: auth=OWNER_TOKEN_HERE"
    ```
* **Success Response (200 OK - No Pagination Requested):**
    ```json
    {
      "status": "ignore",
      "message": "Company users fetched successfully.",
      "data": {
         "users": [
           // Array of User objects
           {
             "id": "c1a9b0d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d",
             "name": "Seed Leader",
             "age": 19,
             "hourly_wage": 2350,
             "role": 2,
             "company_id": "A company ID that I am not going to write out yet again.",
             "verified": true,
             "created_at": "2025-04-20T08:30:00.000Z",
             "avatar_url": null
           }
           // ... other users
         ]
        }
    }
    ```
* **Success Response (200 OK - Pagination Requested):**
    ```json
    {
      "status": "ignore",
      "message": "Company users fetched successfully.",
      "data": {
         "users": [
           // Array of User objects for the current page
           {
             "id": "c1a9b0d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d",
             "name": "Seed Leader",
             "age": 19,
             "hourly_wage": 2350,
             "role": 2,
             "company_id": "A company ID that I am not going to write out yet again.",
             "verified": true,
             "created_at": "2025-04-20T08:30:00.000Z",
             "avatar_url": null
           }
           // ... other users for this page
         ],
         "pagination": {
           "totalPages": 3,
           "currentPage": 1,
           "limit": 10,
           "totalItems": 29
         }
       }
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                                 | Example Response Body                                                                 |
  |:------------|:----------------------------------------|:--------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                       | (Handled by `getUserFromCookie`)                                                      |
  | `403`       | Employee attempting access              | `{"status": "error", "message": "Employees do not have permission..."}`               |
  | `400`       | Requester not associated with a company | `{"status": "error", "message": "Requesting user is not associated with a company."}` |
  | `500`       | Database error                          | `{"status": "error", "message": "There was an unexpected error..."}`                  |

#### `GET /company/user/:userId`

* **Description:** Fetches specific details (id, name, role, hourly wage) for a single user within the company. Access is restricted based on the requester's role and relationship to the target user.
* **Permissions:** Authenticated User.
  * Employee: Can only view their own data.
  * Leader/Owner: Can view data for users in the same company whose role is less than or equal to their own.
* **URL Parameters:** `:userId` (UUID of the target user).
* **`curl` Example:**
    ```bash
    # Owner fetching Leader's details
    curl -X GET http://localhost:3000/company/user/LEADER_USER_ID_HERE \
         -H "Cookie: auth=OWNER_TOKEN_HERE"

    # Employee fetching own details
    curl -X GET http://localhost:3000/company/user/EMPLOYEE_USER_ID_HERE \
         -H "Cookie: auth=EMPLOYEE_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "ignore",
      "message": "User data fetched successfully.",
      "data": {
        "id": "f0744a3b-71d4-4d96-9e70-b2f3d4acb727",
        "name": "Bob Johnson",
        "hourlyWage": 15,
        "role": 1
      }
    }
    ```
* **Error Responses:**

  | Status Code | Meaning                                                  | Example Response Body                                                       |
  |:------------|:---------------------------------------------------------|:----------------------------------------------------------------------------|
  | `401`       | Not authenticated                                        | (Handled by `getUserFromCookie`)                                            |
  | `403`       | Admin, or Employee viewing other, or viewing higher role | `{"status": "error", "message": "Employees can only view their own data."}` |
  | `404`       | Target user not found or not in the requester's company  | `{"status": "error", "message": "User not found."}`                         |
  | `500`       | Database error                                           | `{"status": "error", "message": "There was an unexpected error..."}`        |

#### `PATCH /company/verify/:userId`

* **Description:** Marks a user within the company as verified.
* **Permissions:** Leader or Owner ([See Table](#6-role-permissions-summary): `company:verify`).
* **URL Parameters:** `:userId` (UUID of the user to verify).
* **Request Body:** None.
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/company/verify/USER_TO_VERIFY_ID_HERE \
         -H "Cookie: auth=LEADER_OR_OWNER_TOKEN_HERE"
    ```
* **Success Response (200 OK):**
  * If user was unverified:
      ```json
      { "status": "success", "message": "User verified successfully." }
      ```
  * If user was already verified:
      ```json
      { "status": "success", "message": "User is already verified." }
      ```
* **Error Responses:**

  | Status Code | Meaning                                             | Example Response Body                                                        |
  |:------------|:----------------------------------------------------|:-----------------------------------------------------------------------------|
  | `401`       | Not authenticated                                   | (Handled by `getUserFromCookie`)                                             |
  | `403`       | Employee attempting action or not in a company      | `{"status": "error", "message": "Only Leaders or Owners can verify users."}` |
  | `404`       | Target user not found or not in requester's company | `{"status": "error", "message": "User to verify not found."}`                |
  | `500`       | Database error                                      | `{"status": "error", "message": "There was an unexpected error..."}`         |

#### `PATCH /company/user/:userId`

* **Description:** Updates the role and/or hourly wage for a user within the company.
* **Permissions:** Owner Only ([See Table](#6-role-permissions-summary): `company:update`). Cannot update self or other Owners.
* **URL Parameters:** `:userId` (UUID of the user to update).
* **Request Body Example (Update Role and Wage):**
    ```json
    {
      "role": 2,
      "hourlyWage": 25
    }
    ```
* **Request Body Example (Update Role Only):**
    ```json
    {
      "role": 2
    }
    ```
* **Request Body Example (Update Wage Only):**
    ```json
    {
      "hourlyWage": 22
    }
    ```
* **`curl` Example:**
    ```bash
    curl -X PATCH http://localhost:3000/company/user/USER_TO_UPDATE_ID_HERE \
         -H "Content-Type: application/json" \
         -H "Cookie: auth=OWNER_TOKEN_HERE" \
         -d '{ "role": 2, "hourlyWage": 25 }'
    ```
* **Success Response (200 OK):**
    ```json
    { "status": "success", "message": "User data updated successfully." }
    ```
* **Error Responses:**

  | Status Code | Meaning                                                | Example Response Body                                                                         |
  |:------------|:-------------------------------------------------------|:----------------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                                      | (Handled by `getUserFromCookie`)                                                              |
  | `403`       | Not Owner, or attempting to update self/other Owner    | `{"status": "error", "message": "Only Owners can update user data."}` OR `"Cannot update..."` |
  | `400`       | Invalid data (e.g., missing fields, invalid role/wage) | `{"status": "error", "message": "Invalid data provided.", "errors": {...}}`                   |
  | `404`       | Target user not found or not in requester's company    | `{"status": "error", "message": "User to update not found."}`                                 |
  | `500`       | Database error                                         | `{"status": "error", "message": "There was an unexpected error..."}`                          |

---

### 7.6 User (`/user`)

Manages user-specific settings. Found in `routes/user.ts`.

#### `POST /user/avatar`

* **Description:** Uploads/updates user avatar. Uses `multipart/form-data`.
* **Permissions:** Authenticated User (Any role updates own).
* **Request Body:** `multipart/form-data` with `avatar` field (image file, max 2MB).
* **`curl` Example:**
    ```bash
    curl -X POST http://localhost:3000/user/avatar -H "Cookie: auth=VALID_TOKEN_HERE" -F "avatar=@my_avatar.png"
    ```
* **Success Response (200 OK):**
    ```json
    {
      "status": "success",
      "message": "Avatar uploaded successfully.",
      "data": { "avatarUrl": "https://.../storage/v1/object/public/avatars/..." }
    }
    ```
* **Error Responses:** See table in previous response section (includes 400 for file issues - missing, type, size).

#### `PATCH /user/profile`

* **Description:** Updates the name and/or age for the currently authenticated user. Updates the name in Supabase Auth metadata (synced via trigger to `public.user`) and updates the age directly in the `public.user` table. At least one field (`name` or `age`) must be provided.
* **Permissions:** Authenticated User (Any role updates their own profile).
* **Request Body Examples:**
  * Update Name Only:
      ```json
      { "name": "New Updated Name" }
      ```
  * Update Age Only:
      ```json
      { "age": 42 }
      ```
  * Update Both:
      ```json
      { "name": "New Updated Name", "age": 42 }
      ```
* **Schema:** Requires at least `name` (string, 1-150 chars) or `age` (number, 14-120). Both are optional individually.
* **`curl` Example (Updating Both):**
    ```bash
    curl -X PATCH http://localhost:3000/user/profile \
         -H "Content-Type: application/json" \
         -H "Cookie: auth=VALID_TOKEN_HERE" \
         -d '{ "name": "New Updated Name", "age": 42 }'
    ```
* **Success Response (200 OK):**
  * If changes were made:
      ```json
      {
        "status": "success",
        "message": "User profile updated successfully.",
        "data": {
          // Contains only the fields that were successfully updated
          "name": "New Updated Name"
        }
      }
      ```
  * If no changes were needed (input matched existing data):
      ```json
      {
        "status": "success",
        "message": "No changes detected or needed.",
        "data": {}
      }
      ```
* **Error Responses:**

  | Status Code | Meaning                                               | Example Response Body                                                                                                                     |
  |:------------|:------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------|
  | `401`       | Not authenticated                                     | (Handled by `getUserFromCookie`)                                                                                                          |
  | `422`       | Validation Error (e.g., empty body, name/age invalid) | `{"status": "error", "message": "Invalid data provided.", "errors": {...}}`                                                               |
  | `500`       | Supabase/DB update error or unexpected server error   | `{"status": "error", "message": "Failed to update user name..." OR "Failed to update user age..." OR "There was an unexpected error..."}` |

---

## 8. Database Schema

The application utilizes a PostgreSQL database, typically managed via Supabase.

### 8.1 Entity-Relationship Diagram (ERD)


![ERD Description](./docs/images/NexusOps_Database_ERD.png)

### 8.2 Schema Overview

* **User & Company:** Core entities defining users, their roles, and company affiliations.
* **Ticketing:** `ticket` and `ticket_response` handle support requests.
* **Scheduling:** `schedule` stores work shifts with categories and finalization status.
* **Training:** `training` defines modules with questions. `submission` tracks completed attempts, and `training_in_progress` tracks ongoing attempts.

### 8.3 Table Details

*(Based on `supabase/migrations/20250411000000_initial_schema.sql`)*

| Table                      | Column        | Type           | Constraints & Notes                                                       |
|:---------------------------|:--------------|:---------------|:--------------------------------------------------------------------------|
| **`company`**              | `id`          | `uuid`         | PK, default: `uuid_generate_v4()`                                         |
|                            | `name`        | `varchar(100)` | NOT NULL                                                                  |
|                            | `code`        | `varchar(8)`   | NOT NULL                                                                  |
|                            | `created_at`  | `timestamptz`  | default: `CURRENT_TIMESTAMP`                                              |
| **`user`**                 | `id`          | `uuid`         | PK, default: `uuid_generate_v4()` - *Matches `auth.users.id`*             |
|                            | `name`        | `varchar(150)` | NOT NULL                                                                  |
|                            | `age`         | `smallint`     | nullable                                                                  |
|                            | `hourly_wage` | `integer`      | nullable                                                                  |
|                            | `role`        | `smallint`     | NOT NULL - *Enum: 1:Emp, 2:Leader, 3:Owner, 4:Admin*                      |
|                            | `company_id`  | `uuid`         | nullable, FK -> `company.id`                                              |
|                            | `verified`    | `boolean`      | NOT NULL, default: `false`                                                |
|                            | `created_at`  | `timestamptz`  | default: `CURRENT_TIMESTAMP`                                              |
|                            | `avatar_url`  | `text`         | nullable                                                                  |
| **`ticket`**               | `id`          | `uuid`         | PK, default: `uuid_generate_v4()`                                         |
|                            | `title`       | `varchar(50)`  | NOT NULL                                                                  |
|                            | `content`     | `text`         | NOT NULL                                                                  |
|                            | `closed`      | `boolean`      | NOT NULL, default: `false`                                                |
|                            | `user_id`     | `uuid`         | NOT NULL, FK -> `user.id`                                                 |
|                            | `company_id`  | `uuid`         | nullable, FK -> `company.id`                                              |
|                            | `created_at`  | `timestamptz`  | default: `CURRENT_TIMESTAMP`                                              |
| **`ticket_response`**      | `id`          | `uuid`         | PK, default: `uuid_generate_v4()`                                         |
|                            | `content`     | `text`         | NOT NULL                                                                  |
|                            | `user_id`     | `uuid`         | NOT NULL, FK -> `user.id`                                                 |
|                            | `ticket_id`   | `uuid`         | NOT NULL, FK -> `ticket.id`                                               |
|                            | `created_at`  | `timestamptz`  | default: `CURRENT_TIMESTAMP`                                              |
| **`schedule`**             | `id`          | `uuid`         | PK, default: `uuid_generate_v4()`                                         |
|                            | `start`       | `timestamptz`  | NOT NULL                                                                  |
|                            | `end`         | `timestamptz`  | NOT NULL                                                                  |
|                            | `category`    | `smallint`     | NOT NULL - *Enum: 1:Paid, 2:Unpaid*                                       |
|                            | `user_id`     | `uuid`         | NOT NULL, FK -> `user.id`                                                 |
|                            | `company_id`  | `uuid`         | NOT NULL, FK -> `company.id`, ON DELETE CASCADE                           |
|                            | `finalized`   | `boolean`      | NOT NULL, default: `false`                                                |
| **`training`**             | `id`          | `uuid`         | PK, default: `uuid_generate_v4()`                                         |
|                            | `name`        | `varchar(100)` | NOT NULL, Unique with `company_id`                                        |
|                            | `description` | `text`         | NOT NULL                                                                  |
|                            | `file_url`    | `text`         | NOT NULL - *Path in Supabase Storage*                                     |
|                            | `created_at`  | `timestamptz`  | default: `CURRENT_TIMESTAMP`                                              |
|                            | `role`        | `smallint`     | NOT NULL - *Target UserRole*                                              |
|                            | `company_id`  | `uuid`         | NOT NULL, FK -> `company.id`, ON DELETE CASCADE                           |
|                            | `questions`   | `jsonb`        | NOT NULL - *Array: `{id, name, answers: [{text, correct}], multCorrect}`* |
| **`submission`**           | `id`          | `uuid`         | PK, default: `gen_random_uuid()`                                          |
|                            | `user_id`     | `uuid`         | NOT NULL, FK -> `user.id`, ON DELETE CASCADE, Unique with `training_id`   |
|                            | `company_id`  | `uuid`         | NOT NULL, FK -> `company.id`, ON DELETE CASCADE                           |
|                            | `training_id` | `uuid`         | NOT NULL, FK -> `training.id`, ON DELETE CASCADE, Unique with `user_id`   |
|                            | `answers`     | `jsonb`        | NOT NULL - *Array: `{id, answers: ["..."]}`*                              |
|                            | `created_at`  | `timestamptz`  | NOT NULL, default: `now() AT TIME ZONE 'utc'`                             |
| **`training_in_progress`** | `id`          | `uuid`         | PK, default: `gen_random_uuid()`                                          |
|                            | `user_id`     | `uuid`         | NOT NULL, FK -> `user.id`, ON DELETE CASCADE, Unique with `training_id`   |
|                            | `training_id` | `uuid`         | NOT NULL, FK -> `training.id`, ON DELETE CASCADE, Unique with `user_id`   |

### 8.4 Database Triggers

These PostgreSQL functions synchronize `public.user` with `auth.users`:

* **`handle_new_user()` (Trigger on `auth.users` AFTER INSERT):** Creates a `public.user` record using metadata from Supabase sign-up.
* **`handle_update_user()` (Trigger on `auth.users` AFTER UPDATE):** Updates `public.user` if metadata changes in Supabase Auth.
* **`handle_delete_user()` (Trigger on `auth.users` AFTER DELETE):** Deletes the corresponding `public.user` record.

## 9. Error Handling

The API uses standard HTTP status codes. See the "Error Responses" tables within each [API Route](#7-api-routes) section for endpoint-specific errors. General codes include:

* **General Response Structure (`types/response.ts`):**
    ```typescript
    export interface ApiResponse<D = unknown, E = unknown> {
      status: "success" | "error" | "ignore"; // ignore often used for GET success
      message: string;
      data?: D; // Payload for success/ignore responses
      errors?: E; // Details about errors (e.g., validation failures)
    }
    ```
* **Common Status Codes:**
  * `200 OK`: Standard success for GET, PATCH, DELETE (if successful).
  * `201 Created`: Success for POST requests that create a new resource.
  * `207 Multi-Status`: Used when a batch operation (like POST /schedule) partially succeeds. The response body contains details about individual failures.
  * `400 Bad Request`: The request was malformed (e.g., invalid JSON) or failed business logic/validation rules (e.g., Zod schema failure, schedule constraint violation, file upload issues). The `errors` field often contains details.
  * `401 Unauthorized`: Authentication required or failed (invalid/missing token). Handled primarily by the `getUserFromCookie` middleware.
  * `403 Forbidden`: Authentication succeeded, but the user lacks the necessary permissions (based on `hasPermission` checks) to perform the requested action on the specific resource.
  * `404 Not Found`: The requested resource (e.g., ticket, training, user, company) does not exist or is not accessible to the user (often indistinguishable from a permission issue from the client's perspective for security).
  * `422 Unprocessable Entity`: The request format was correct, but semantic errors occurred (e.g., email already exists during sign-up, as reported by Supabase Auth). Often used for validation errors originating from external services like Supabase Auth.
  * `500 Internal Server Error`: A generic error indicating an unexpected issue on the server (e.g., database connection error, unhandled exception in route logic). The response message is usually generic to avoid leaking details. Check server logs for specifics.

* **General Error Response Structure Example:**
    ```json
    {
      "status": "error",
      "message": "A descriptive error message.",
      "errors": { /* Optional: Zod error structure or custom error object */ }
    }
    ```

## 10. Security Considerations

* **Authentication:** JWTs via Supabase Auth, stored in secure, HTTP-only cookies (`auth`, `refresh`). Token refresh logic is implemented in [`lib/utils.ts`](#53-libutilsts).
* **Authorization:** Role-Based Access Control (RBAC) is implemented via the [`lib/roles.ts`](#54-librolests) module and the `hasPermission` function, ensuring users can only access resources and perform actions appropriate for their role and data ownership/company affiliation.
* **Input Validation:** Zod schemas (`schemas/auth.ts` and inline schemas in routes) are used extensively to validate request bodies and parameters, preventing invalid data from reaching business logic or the database.
* **CORS:** Configured in `index.ts` using the `cors` middleware, restricting access to the `ORIGIN_URL` specified in environment variables. `credentials: true` is enabled to allow cookies to be sent from the frontend.
* **File Uploads:** `multer` is used for handling file uploads (`/user/avatar`, `/training`), enforcing size limits and basic file type checks (images for avatars) to prevent abuse. File paths stored in the DB are sanitized in the `/training` route.
* **Database Security:** Uses Supabase's PostgreSQL. Direct database interaction uses the `pg` library. The application layer authorization (`hasPermission`) provides the primary defense. Triggers use `SECURITY DEFINER` carefully to sync `public.user` with `auth.users`. Ensure the database user configured via `POSTGRES_URL` has appropriate, minimal privileges.
* **Secrets Management:** Sensitive keys (`SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL`) are managed via environment variables and should not be hardcoded. Ensure `.env` files are in `.gitignore`.

## 11. Testing

The project includes unit and integration tests using Vitest and Supertest.

### 11.1 Requirements for Testing

To run the integration tests locally, you typically need:

* **Supabase CLI:** For managing the local Supabase environment (`supabase start`, `supabase db reset`).
* **Docker Desktop:** Required by Supabase CLI.
* **Database State:** Migration files (`/supabase/migrations`) and seed data (`/supabase/seed.sql`) are essential for initializing the test database schema and state.
* **Environment File:** A `.env.test` file configured with test-specific settings, especially `POSTGRES_URL` pointing to the local test database managed by Supabase CLI.

### 11.2 Running Tests

Test scripts are defined in `package.json`:

* **Run all tests:**
    ```bash
    pnpm test
    # or: npm test | BUN TEST DOES NOT WORK!!!
    ```
  This executes `vitest run tests/`.
* **Reset Database and Run Tests:**
    ```bash
    pnpm run test:reset
    # or: npm run test:reset | BUN TEST DOES NOT WORK!!!
    ```
  This runs `supabase db reset --local && vitest run -c vitest.config.ts`. It ensures a clean database state based on migrations and seeds before executing the test suite. This is recommended for reliable integration testing.

Vitest configuration (`vitest.config.ts`) includes setup files (`tests/loadEnv.ts`, `tests/setup.ts`) for environment loading and mocking external dependencies like Supabase client calls.

### 11.3 Test Files and Coverage

* **Unit Tests:**
  * `tests/lib/roles.test.ts`: Validates the core `hasPermission` logic against various role/resource/action scenarios.
* **Integration Tests (`tests/integration/`):** Use `supertest` to test the API endpoints by simulating HTTP requests and verifying responses and database side-effects. Supabase Auth/Storage calls are mocked (see `tests/setup.ts`).
  * `auth.integration.test.ts`: Covers user sign-up (company/employee), sign-in, sign-out, fetching authenticated user data, and token refresh logic via middleware.
  * `company.integration.test.ts`: Covers company name updates, user listing (including pagination and filtering), fetching specific user details, user verification, and owner updating user roles/wages.
  * `schedule.integration.test.ts`: Covers fetching schedule views (weekly overview, hourly details), creating schedules (including constraint validation like overlaps, rest periods, max hours, age restrictions), fetching users for scheduling, finalizing schedules, deleting, and updating schedules.
  * `ticket.integration.test.ts`: Covers creating tickets (for company or admin), listing tickets based on role permissions, fetching single ticket details (with optional responses), updating ticket status (closing/opening), and adding/retrieving ticket responses.
  * `training.integration.test.ts`: Covers listing available trainings (role-based, active/completed status), fetching submission results (general summaries and detailed test results), fetching individual training details (including questions for active tests and file URLs for inactive ones), creating new trainings with file uploads, starting trainings, and submitting answers.
  * `user.integration.test.ts`: Covers user profile updates (avatar, combined name/age).

**Coverage Goal:** While aiming for high (~100%) coverage, the actual percentage requires a coverage reporting tool. The existing tests provide significant coverage across all API modules.

## 12. Future Development / TODOs

* Implement the `/company/logo` update route.
* Refine error handling for more specific client feedback where appropriate.
* Add database indexing for performance optimization based on common query patterns.
* Integrate a code coverage reporting tool.
* Consider adding request rate limiting.