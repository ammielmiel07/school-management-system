# PDFMNHS Online Management System
A web-based school management system for Prudencia D. Fule Memorial National High School, designed to streamline academic and administrative processes for administrators, faculty, learners, and parents. Built with Next.js, React, TypeScript, Node.js, and PostgreSQL.

## Features
* **Role-Based Access Control** – Separate access for administrators, faculty, learners, and parents.
* **Student Information Management** – Manage and organize learner records and profiles.
* **Academic Records Management** – Handle learner grades and academic records.
* **Class and Faculty Management** – Organize class assignments and faculty information.
* **Learner & Parent Portal** – Provide learners and parents access to relevant learner information and academic progress.
* **Automated Report Generation** – Generate school forms and reports, including SF1, SF2, SF9, and SF10.
* **Grade Visibility Control** – Restrict grade viewing until required PTA meeting attendance is fulfilled.
* **Secure Authentication** – User authentication, role-based permissions, and mandatory password changes for applicable accounts.


## Tech Stack
| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, HTML, CSS |
| Backend | Node.js, JavaScript |
| Database | PostgreSQL |


## Prerequisites

You need the project files, a PostgreSQL database, and a configuration file. GitHub Desktop downloads and updates the code. Node.js runs the backend and frontend, while PostgreSQL stores accounts, grades, and other school records.

| Application | Purpose |
| --- | --- |
| [GitHub Desktop](https://desktop.github.com/download/) | Downloads the repository and retrieves updates through buttons. Keep using your existing installation if you already have it. |
| [Node.js](https://nodejs.org/en/download) | Runs the application and includes npm, which installs its required packages. Choose Node.js 24 LTS; this project requires Node.js 22.18 or newer. |
| [PostgreSQL for Windows](https://www.postgresql.org/download/windows/) | Stores the application data. Install the PostgreSQL server and pgAdmin components. |

A browser and text editor are also needed. The browser and Notepad already included with Windows are sufficient; a code editor is optional. During PostgreSQL installation, remember the password you choose for the `postgres` user and keep the default port, `5432`, unless it is already in use.

### Steps for the Project Owner

1. Open GitHub Desktop and select this project. If it is missing, choose **File > Add Local Repository**, select your existing `school-management-system` folder, and click **Add Repository**.
2. Check the **Current branch** and tell your friend which branch to use.
3. Review the **Changes** tab. Include the updated source files, this README, and `backend/.env.example`. Keep your real `.env` file private; it is excluded by `.gitignore`.
4. Enter a summary such as `Fix system errors and add setup guide`, then click **Commit to [your branch]**.
5. Click **Push origin** to upload the committed changes to GitHub. A commit saves changes on your computer; pushing makes them available online. If this is a new branch, use **Publish branch**.
6. Send your friend the repository URL and branch name. For a private repository, give their GitHub account access first.

The repository includes `backend/schema.sql`, both `package-lock.json` files, spreadsheet templates, and public assets. The setup below creates a fresh database. To share your existing school records too, see **Using the same existing records** below.

GitHub documents [adding a local repository](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop), [committing changes](https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop), and [pushing changes](https://docs.github.com/en/desktop/making-changes-in-a-branch/pushing-changes-to-github-from-github-desktop).

## Getting Started

### 1. Clone the Repository Using GitHub Desktop

1. Open GitHub Desktop and sign in to your own GitHub account.
2. Choose **File > Clone Repository**.
3. Select the **URL** tab and paste the repository URL provided by the project owner.
4. Choose a **Local Path** where you want to save the project, then click **Clone**.
5. Use **Current branch** to select the same branch as the project owner.
6. Choose **Repository > Show in Explorer** to open the downloaded project folder. This is the main project folder, containing `backend`, `frontend`, and this README.

See GitHub's [cloning instructions](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop).

### 2. Create a New Database

1. Open **pgAdmin** and connect to your local PostgreSQL server using the `postgres` password chosen during installation.
2. Expand the server, right-click **Databases**, and choose **Create > Database**.
3. Enter `school_management` as the database name and click **Save**.
4. Right-click the new `school_management` database and open **Query Tool**.
5. Use the Query Tool's open-file button to open `backend/schema.sql` from the downloaded project.
6. Click **Execute script** to run the entire file. Check the **Messages** panel for successful execution, then refresh the database's table list.

This creates the required tables, default settings, and a local administrator account. Run `schema.sql` only on a **new, empty database**. It is not a migration for an existing installation. If you are restoring a database backup instead, skip the schema import.

See the [pgAdmin Query Tool instructions](https://www.pgadmin.org/docs/pgadmin4/latest/query_tool.html).

### 3. Configure the Backend Environment

1. Open the downloaded project's `backend` folder in File Explorer.
2. Make a copy of `.env.example` and rename the copy to exactly `.env`. Keep the example file unchanged.
3. Open `.env` in your text editor and replace the password and secret placeholders:

```env
DB_USER=postgres
DB_PASSWORD=replace_with_your_postgresql_password
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=school_management

JWT_SECRET=replace_with_a_generated_random_secret
PORT=5000
```

`DB_PASSWORD` is your local PostgreSQL password. `DB_DATABASE` must match the database you created. `JWT_SECRET` is a private value used to protect login sessions.

To generate that secret, click the File Explorer address bar, type `cmd`, and press Enter. In the Command Prompt window, run:

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated text after `JWT_SECRET=` and save `.env`. Show file extensions in File Explorer if needed to make sure the filename is `.env`, rather than `.env.txt`.

The frontend uses `http://localhost:5000` for the backend by default, so it needs no configuration file for this setup.

### 4. Install Dependencies and Start the Backend

Open the project's `backend` folder in File Explorer. Click its address bar, type `cmd`, and press Enter. Run these commands one at a time:

```bat
npm ci
npm run dev
```

`npm ci` downloads the package versions recorded in `package-lock.json`. Keep the lock files in the repository so both computers install consistent dependencies. See the [npm documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Wait for `Server is running on port 5000`. Keep this terminal open.

### 5. Install Dependencies and Start the Frontend

Open the project's `frontend` folder in File Explorer. Type `cmd` in its address bar and press Enter to open a **second** Command Prompt window. Run:

```bat
npm ci
npm run dev
```

Keep both terminal windows open. The backend handles requests and the frontend displays the website.

### 6. Access the System and Log In

Visit [http://localhost:3000](http://localhost:3000) in your browser. `localhost` means your own computer.

For a fresh database created from `schema.sql`, use:

```text
Username: admin
Password: admin123
```

These are the starter credentials for local setup. If you restored an existing database, use an account from that database instead.

To stop the application, press **Ctrl+C** in each terminal. The next time you use it, repeat `npm run dev` in the `backend` and `frontend` folders. You do not need to recreate the database or repeat `npm ci` unless the required packages change.

### 7. Configure Email Delivery (Optional)

The system uses Gmail for account and password-reset emails. To use those features, enable two-step verification on your own test Gmail account, create a Google App Password, and add these settings to `backend/.env`:

```env
EMAIL_USER=your_test_account@gmail.com
EMAIL_PASS=your_google_app_password
```

Use the App Password here. `EMAIL_FROM` is optional. Restart the backend after changing the configuration. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833).

Without email configuration, the application can run, but credential and password-reset emails will not be delivered.

## Updating the Project

After the project owner commits and pushes an update, select the same repository and branch in GitHub Desktop, click **Fetch origin**, and click **Pull origin** if updates are available. Save or commit any edits of your own before pulling. See [GitHub's synchronization instructions](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/syncing-your-branch-in-github-desktop).

Stop both development servers before updating. If `package.json` or `package-lock.json` changed, run `npm ci` in the affected folder, then restart both servers. Follow any database migration instructions included with the update; do not rerun `schema.sql` on your existing database.

## Using Existing School Records

GitHub transfers code, while school records are stored in PostgreSQL. If you want the same existing accounts, learners, grades, and settings, the project owner must also provide a PostgreSQL backup to restore into a new database, plus any associated files in `backend/uploads`. Restore that backup **instead of** importing `schema.sql`, and use login credentials from the restored database. Share school records privately when appropriate.

Each computer has its own database. Code updates through GitHub Desktop do not synchronize school records between computers.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `node` or `npm` is not recognized | Finish installing Node.js, then close and reopen Command Prompt. Check `node --version` and `npm --version`. |
| PowerShell says scripts are disabled | Use Command Prompt as described above, or use `npm.cmd` in place of `npm`. |
| `JWT_SECRET must be configured` | Check that `backend/.env` exists, contains your generated secret, and is saved. Start the backend from its own folder. |
| Database connection or authentication fails | Check that PostgreSQL is running and that the database name, port, username, and password match `.env`. |
| A database table does not exist | Confirm you imported the complete schema into the same database named in `.env`. |
| The page opens but login or data requests fail | Check the backend terminal for errors and confirm the backend is running on port 5000. |
| The frontend uses a different port | Stop the other application using port 3000, or open the URL shown in the frontend terminal. |
| Account or reset emails fail | Check your Gmail address and App Password, then restart the backend. |

## Backend URL and CORS Configuration

The frontend proxies `/api` and `/uploads` to the backend. For a different backend address or port, set `BACKEND_URL` in `frontend/.env.local` before starting or building Next.js:

```env
BACKEND_URL=http://localhost:5000
```

If accessing the API directly from another origin, `FRONTEND_URL` in the backend configuration optionally restricts CORS to that origin.

## Testing and Validation

- `backend`: `npm test` exercises request validation, authorization, failed writes, credential delivery failures, and grade boundaries with isolated fixtures.
- `backend`: set `RUN_DB_TESTS=1` before `npm test` to also verify grading against PostgreSQL using temporary tables that are rolled back, and plan API queries against the actual database schema. No existing school records are changed.
- `frontend`: `npm test`, `npm run lint`, and `npm run build` check request handling, grade calculations, dates, and the production build. The frontend unit tests use Node.js TypeScript support.
- `frontend`: `node tests/browser-smoke.mjs` runs headless browser checks against fake API data. It defaults to Microsoft Edge on Windows; set `BROWSER_PATH` for another Chromium browser. Screenshots are stored in `.next/browser-smoke`.


## Key Fixes and Improvements

### Grading and Academic Records

* Grading weights use whole percentages consistently. Missing item scores contribute to the maximum possible score, while recorded zeros remain valid grades.
* Saving scores and computed grades uses a single transaction. Changing grade items recomputes existing results, and clearing an entered score removes its stored value.
* Account, enrollment, and teaching-assignment removals protect recorded grades.

### Account Management and Security

* Account creation and updates use dedicated database transactions.
* Generated credentials require password setup on first login.
* Email delivery failures are reported accurately. Created credentials remain available to administrators when delivery fails, while failed password-reset emails leave the current password unchanged.
* Password changes invalidate earlier sessions, and reset tokens cannot access portal data.
* Login and password-reset requests are throttled per account and client address. Existing sessions issued before these fixes require a fresh login.

### Validation and Access Control

* Faculty attendance, core values, and grade visibility are restricted to the faculty member's advisory class.
* Requests validate identifiers, required fields, score limits, dates, school years, attendance, and grading percentages.
* Uploads accept PNG, JPG, or WebP files up to 5 MB, with file-signature checks.

### Interface and Usability

* Portals share responsive navigation, active-page feedback, accessible keyboard controls, and dismissible request notices.
* Account management distinguishes API failures from empty records.
* The gradebook protects unsaved changes, and grade tabs remain synchronized with the displayed trimester.
