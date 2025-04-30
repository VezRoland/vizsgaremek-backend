# NexusOps - Backend

> 🚧 This project is **under heavy development** until further notice (expected through the end of May).

Please note that:
- This **does not represent the final product**.
- Functionality, structure, and code may **change completely without warning**.
- Documentation and features are **incomplete and subject to major revisions**.

We recommend **not relying on this repository** for anything critical at this stage.

Stay tuned!

## Table of Contents

- [Introduction](#introduction)
- [Requirements](#requirements)
- [Setup and Running](#setup-and-running)
- [API Routes](#api-routes)
    - [Authentication (`/auth`)](#authentication-auth)
    - [Tickets (`/ticket`)](#tickets-ticket)
    - [Schedule (`/schedule`)](#schedule-schedule)
    - [Training (`/training`)](#training-training)
- [Core Libraries & Utilities (`/lib`)](#core-libraries--utilities-lib)
    - [`postgres.ts`](#postgrests)
    - [`supabase.ts`](#supabasesets)
    - [`utils.ts`](#utilsts)
    - [`roles.ts`](#rolests)
- [Database](#database)
    - [Schema Overview](#schema-overview)
    - [Table Details](#table-details)
- [Testing](#testing)

## Introduction

This document provides documentation for the backend of the NexusOps company management system. It covers setup, requirements, API routes, core utilities, database structure, and testing procedures.

## Requirements

The backend requires Node.js (or Bun) and the dependencies listed in the `package.json` file. Key dependencies include:

* **Express.js:** Web framework for building the API.
* **Cors:** Middleware for enabling Cross-Origin Resource Sharing.
* **Cookie-parser:** Middleware for parsing cookies.
* **@supabase/supabase-js:** Client library for interacting with Supabase (Authentication and potentially other services).
* **pg:** Node.js client for PostgreSQL database interaction.
* **Zod:** Library for schema declaration and validation.
* **Multer:** Middleware for handling multipart/form-data, primarily used for file uploads.

Development dependencies include TypeScript types for various libraries and `supertest` for API testing.

## Setup and Running

1.  **Install Dependencies:**
    ```bash
    # Using npm
    npm install

    # Using bun
    bun install
    ```
2.  **Environment Variables:** Ensure you have the necessary environment variables set up, particularly for Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and the PostgreSQL database (`POSTGRES_URL`). You might also need `ORIGIN_URL` for CORS configuration.
3.  **Run the Development Server:**
    ```bash
    # Using bun with watch mode
    bun run dev
    ```
    This command uses `bun run --watch index.ts` to start the server and automatically restart it on file changes. The server typically runs on port 3000 unless specified otherwise by the `PORT` environment variable.

## API Routes

The backend exposes several API routes mounted under different base paths in `index.ts`. All routes generally expect JSON request bodies and return JSON responses following the `ApiResponse` structure defined in `types/response.ts`. Authentication is handled via cookies (`auth` cookie) parsed by the `getUserFromCookie` middleware.

### Authentication (`/auth`)

Handles user sign-up, sign-in, sign-out, and fetching user data.

* **`POST /auth/sign-in`**: Authenticates a user using email and password. Uses Supabase Auth (`signInWithPassword`). Sets an HTTP-only `auth` cookie on success. Validates request body using `signInSchema`.
* **`POST /auth/sign-up/employee`**: Registers a new employee user. Requires name, email, password, and a valid company code. Creates the user via Supabase Admin (`admin.createUser`) with `Employee` role and associates them with the company found via the code. Validates request body using `signUpEmployeeSchema`.
* **`POST /auth/sign-up/company`**: Registers a new company and an owner user. Requires name, email, password, and company name. Creates a new company in the database and then creates the user via Supabase Admin (`admin.createUser`) with `Owner` role. Validates request body using `signUpCompanySchema`.
* **`POST /auth/sign-out`**: Signs the user out by invalidating the session token via Supabase Admin (`admin.signOut`) and clearing the `auth` cookie. Requires a valid `auth` cookie.
* **`GET /auth/user`**: Fetches the details of the currently authenticated user from the `user` table based on the ID obtained from the `auth` cookie. Uses the `getUserFromCookie` middleware.

### Tickets (`/ticket`)

Manages support tickets and responses. Access control is enforced using the `hasPermission` utility based on user roles and ticket ownership/company association.

* **`POST /ticket`**: Creates a new ticket. Requires `title`, `content`, and optional `company_id`. Employees can create tickets for their company or for admins (null `company_id`). Owners/Leaders can create tickets for their company or admins.
* **`GET /ticket/all`**: Retrieves a list of tickets accessible to the user based on their role (Admin: null company, Owner/Leader: own or company, Employee: own).
* **`GET /ticket/:id`**: Retrieves details for a single ticket. Optionally includes responses if `include_responses` query parameter is present. Access is checked via `hasPermission`.
* **`PATCH /ticket/:id/status`**: Toggles the `closed` status of a ticket. Only users with `tickets:close` permission (Admins for null-company tickets, Owners/Leaders for company tickets) can perform this action.
* **`POST /ticket/:id/response`**: Adds a response to a specific ticket. Requires `content`. Access is checked via `hasPermission` (`tickets:respond`).
* **`GET /ticket/:id/responses`**: Retrieves all responses for a specific ticket. Access is checked via `hasPermission` (`tickets:view`).

### Schedule (`/schedule`)

Manages work schedules for users within a company. Includes validation for overlapping times, maximum work hours, and minimum rest periods based on user age. Uses `hasPermission` for access control.

* **`GET /schedule`**: Fetches schedules for a specific week.
    * Defaults to the current week if `weekStart` (YYYY-MM-DD) query parameter is not provided.
    * Returns schedule counts grouped by hour and day (`HH-D`, where D is 0=Monday to 6=Sunday) for a calendar view.
    * Provides `prevDate` and `nextDate` for navigation, respecting a half-year future limit and checking for past schedules.
    * Filters results based on user role (Owner/Leader: company schedules, Employee: own schedules).
    * Optionally filters by `category` (1=Paid, 2=Unpaid) query parameter.
* **`GET /schedule/details/:hourDay`**: Fetches detailed schedule entries for a specific hour (0-23) and day (0-6) within a given week (`weekStart` query param required or defaults to current week). Supports pagination (`limit`, `page`).
* **`POST /schedule`**: Creates one or more schedule entries. Requires `start`, `end`, `category`, `companyId`, and an array of `userIds`. Performs validations (min 4 hours, overlaps, rest periods, max hours based on age <18 or >=18) for each user. Requires `schedule:create` permission (Owner/Leader for their company).
* **`GET /schedule/users`**: Fetches users within the company, optionally filtered by `name`. Includes basic schedule info for each user. Supports pagination (`limit`, `page`). Requires `schedule:view` permission.
* **`PATCH /schedule/finalize`**: Marks specified schedules (`scheduleIds` array in body) as finalized. Requires `schedule:finalize` permission (Owner/Leader).
* **`DELETE /schedule`**: Deletes specified schedules (`scheduleIds` array in body). Checks permissions (`schedule:delete`), preventing employees from deleting finalized schedules.
* **`PATCH /schedule/update/:id`**: Modifies the `start` and `end` times of an existing schedule. Requires `schedule:update` permission and performs constraint validations.

### Training (`/training`)

Manages training materials, assignments, and submissions. Uses `multer` for file uploads associated with trainings. Permissions are checked via `hasPermission`.

* **`GET /training`**: Fetches available trainings for the user. Filters by company and role (Employees only see Employee role trainings). Indicates if a training is `active` (in progress) or `completed` for the user.
* **`GET /training/results`**: Fetches submission results.
    * If `testId` query parameter is provided, fetches detailed results (including question breakdowns) for that specific training, filtered by user permissions.
    * If no `testId`, fetches the 10 most recent submission summaries (user, training name, score) for the company (Owner/Leader only).
* **`GET /training/test/:testId`**: Fetches details for a specific training.
    * If the training is marked as active (`training_in_progress` table) for the user, it returns the questions.
    * If not active, it returns training metadata and a signed URL (valid for 1 hour) to download any associated file from Supabase Storage.
* **`POST /training`**: Creates a new training. Uses `multipart/form-data`. Expects training data (`name`, `description`, `role`, `questions` array) as a JSON string in the `data` field and an optional file in the `file` field. Uploads the file to Supabase Storage (`training-files` bucket). Requires `training:create` permission (Owner/Leader).
* **`POST /training/start/:testId`**: Marks a training as active for the user by adding an entry to the `training_in_progress` table. Requires `submission:create` permission for the specific training.
* **`POST /training/submission/:testId`**: Submits answers for a training. Requires `submission:create` permission. Stores the submission details (user answers) in the `submission` table and removes the entry from `training_in_progress`.

## Core Libraries & Utilities (`/lib`)

### `postgres.ts`

* Initializes and exports a PostgreSQL connection pool (`pg.Pool`) using the `POSTGRES_URL` environment variable. This pool is used by routes to interact with the database.

### `supabase.ts`

* Initializes and exports the Supabase client using the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. This client is used primarily for authentication (`/auth` routes) and interacting with Supabase Storage (`/training` routes).

### `utils.ts`

* **`getUserFromCookie(req, res, next)`**: An Express middleware function.
    * It attempts to parse the `auth` cookie from the request.
    * If the cookie exists, it verifies the token using `supabase.auth.getUser()`.
    * If valid, it attaches the `user` object and the `token` to the `req` object and calls `next()`.
    * If the cookie is missing or invalid, it sends a 401 Unauthorized response.

### `roles.ts`

* **`hasPermission(user, resource, action, data)`**: A crucial function for access control.
    * Takes the authenticated `user` object, a `resource` string (e.g., "tickets", "schedule"), an `action` string (e.g., "view", "create"), and optional `data` relevant to the resource.
    * Determines the user's `UserRole` from `user.user_metadata.role`.
    * Looks up the permission rules defined in the `ROLES` constant based on the role, resource, and action.
    * Permissions can be simple booleans or functions that evaluate the `user` and `data` to make a decision (e.g., checking if `user.id` matches `data.userId`, or if `user.user_metadata.company_id` matches `data.companyId`).
    * Returns `true` if the user has permission, `false` otherwise.

## Database

The application uses a PostgreSQL database, connected via the `pg` library configured in `lib/postgres.ts`. The schema details below are from type definitions (`types/database.ts`), SQL queries within the route files and the database itself.

### Schema Overview

* **User Management:** `user`, `company` tables. Users belong to a company (unless they are Admins) and have specific roles.
* **Tickets:** `ticket`, `ticket_response` tables. Tickets are created by users, potentially associated with a company, and can have multiple responses.
* **Scheduling:** `schedule` table. Stores work schedule entries for users, linked to a company and user, with start/end times and categories.
* **Training:** `training`, `submission`, `training_in_progress` tables. Trainings are defined with questions and associated with a company and target role. Users submit answers (`submission`), and active attempts are tracked (`training_in_progress`).

### Table Details

* **`user`**:
    * `id` (UUID, Primary Key): Supabase Auth User ID.
    * `name` (TEXT): User's full name.
    * `age` (INTEGER, Nullable): User's age (used for schedule constraints).
    * `hourly_wage` (NUMERIC, Nullable): User's hourly wage.
    * `role` (INTEGER): Foreign key or enum mapping to `UserRole` (Employee=1, Leader=2, Owner=3, Admin=4).
    * `company_id` (UUID, Nullable): Foreign key referencing `company.id`. Null for Admins.
    * `verified` (BOOLEAN): Indicates if the user is verified.
    * `created_at` (TIMESTAMP): User creation timestamp.
    * `avatar_url` (TEXT, Nullable): URL for user's avatar.
* **`company`**:
    * `id` (UUID, Primary Key): Unique identifier for the company.
    * `name` (TEXT): Name of the company.
    * `code` (TEXT): Unique code for employees to join the company (seen in auth routes).
* **`ticket`**:
    * `id` (UUID, Primary Key): Unique identifier for the ticket.
    * `title` (TEXT): Ticket title.
    * `content` (TEXT): Main content/description of the ticket.
    * `closed` (BOOLEAN): Status of the ticket (open/closed).
    * `user_id` (UUID): Foreign key referencing `user.id` (creator).
    * `company_id` (UUID, Nullable): Foreign key referencing `company.id`. Null for admin tickets.
    * `created_at` (TIMESTAMP): Ticket creation timestamp.
* **`ticket_response`**:
    * `id` (UUID, Primary Key): Unique identifier for the response.
    * `content` (TEXT): Content of the response.
    * `ticket_id` (UUID): Foreign key referencing `ticket.id`.
    * `user_id` (UUID): Foreign key referencing `user.id` (responder).
    * `created_at` (TIMESTAMP): Response creation timestamp.
* **`schedule`**:
    * `id` (UUID, Primary Key): Unique identifier for the schedule entry.
    * `start` (TIMESTAMP): Start date and time of the schedule entry.
    * `end` (TIMESTAMP): End date and time of the schedule entry.
    * `category` (INTEGER): Enum mapping to `ScheduleCategory` (Paid=1, Unpaid=2).
    * `user_id` (UUID): Foreign key referencing `user.id`.
    * `company_id` (UUID, Nullable): Foreign key referencing `company.id`.
    * `finalized` (BOOLEAN): Indicates if the schedule entry is confirmed/locked.
* **`training`**:
    * `id` (UUID, Primary Key): Unique identifier for the training.
    * `name` (TEXT): Name of the training.
    * `description` (TEXT): Description of the training.
    * `role` (INTEGER): Target `UserRole` for the training.
    * `company_id` (UUID, Nullable): Foreign key referencing `company.id`.
    * `created_at` (TIMESTAMP): Training creation timestamp.
    * `questions` (JSONB): Array of question objects, each with `id`, `name`, `answers` (array of {text, correct}), and `multipleCorrect`.
    * `file_url` (TEXT, Nullable): Path to the associated PDF file in Supabase Storage.
* **`submission`**:
    * `id` (UUID, Primary Key): Unique identifier for the submission.
    * `user_id` (UUID): Foreign key referencing `user.id`.
    * `training_id` (UUID): Foreign key referencing `training.id`.
    * `company_id` (UUID, Nullable): Foreign key referencing `company.id`.
    * `created_at` (TIMESTAMP): Submission timestamp.
    * `answers` (JSONB): Array of answer objects, each with question `id` and selected `answer`(s).
* **`training_in_progress`**:
    * `id` (UUID, Primary Key): Unique identifier for the in-progress training.
    * `user_id` (UUID, Primary Key): Foreign key referencing `user.id`.
    * `training_id` (UUID, Primary Key): Foreign key referencing `training.id`.
    * *(Composite Primary Key on `user_id`, `training_id`)* - Tracks which users have started but not yet completed which trainings.

## Testing

The project includes tests for various components.

* **Running Tests:** The tests can be executed using the command defined in `package.json`:
    ```bash
    bun test
    ```
* **Test Files:**
    * `tests/lib/roles.test.ts`: Contains unit tests for the `hasPermission` function, covering various scenarios for different user roles and resources.
    * `tests/routes/schedule.test.ts`: Contains integration tests for the schedule API routes. *Note: The file is still under development, potentially using `vi.mock` (Vitest/Jest) for mocking dependencies like `postgres` and `utils`*.