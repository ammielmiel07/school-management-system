-- POMS database schema for PostgreSQL.
-- This file matches the tables and columns used by backend/server.js.

BEGIN;

CREATE TABLE roles (
    id INT PRIMARY KEY,
    role_name VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO roles (id, role_name) VALUES
    (1, 'Admin'),
    (2, 'Faculty'),
    (3, 'Learner'),
    (4, 'Parent')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    current_school_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    active_trisemester INT NOT NULL DEFAULT 1 CHECK (active_trisemester BETWEEN 1 AND 3),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_settings_row CHECK (id = 1)
);

INSERT INTO system_settings (id, current_school_year, active_trisemester)
VALUES (1, '2026-2027', 1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INT NOT NULL REFERENCES roles(id),
    requires_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default local admin account.
-- Username: admin
-- Password: admin123
INSERT INTO users (username, password_hash, role_id, requires_password_change)
VALUES ('admin', '$2b$10$7gFXleIMwGROA/93Oy7wzOJqK5unPqSlqqBQEQuv80Cy78fsy/Sh.', 1, FALSE)
ON CONFLICT (username) DO NOTHING;

CREATE TABLE faculty_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_no VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    start_school_year VARCHAR(20),
    contact_number VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learner_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lrn VARCHAR(20) UNIQUE NOT NULL,
    birthdate DATE,
    gender VARCHAR(20),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    school_year VARCHAR(20),
    grade_level INT NOT NULL,
    is_star_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    mother_tongue VARCHAR(100),
    ethnic_group VARCHAR(100),
    religion VARCHAR(100),
    house_street VARCHAR(255),
    barangay VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    father_first VARCHAR(100),
    father_middle VARCHAR(100),
    father_last VARCHAR(100),
    mother_first VARCHAR(100),
    mother_middle VARCHAR(100),
    mother_last VARCHAR(100),
    guardian_name VARCHAR(200),
    guardian_relationship VARCHAR(100),
    contact_number VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parent_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_lrn VARCHAR(20) NOT NULL REFERENCES learner_profiles(lrn) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) UNIQUE NOT NULL,
    ww_weight INT NOT NULL CHECK (ww_weight >= 0),
    pt_weight INT NOT NULL CHECK (pt_weight >= 0),
    ex_weight INT NOT NULL CHECK (ex_weight >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subject_weights_total CHECK (ww_weight + pt_weight + ex_weight = 100)
);

CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    grade_level INT NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    is_star_section BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (grade_level, section_name)
);

CREATE UNIQUE INDEX one_star_section_per_grade
ON sections (grade_level)
WHERE is_star_section = TRUE;

CREATE TABLE section_advisories (
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    faculty_id INT NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (section_id, school_year)
);

CREATE TABLE faculty_loads (
    id SERIAL PRIMARY KEY,
    faculty_id INT NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (faculty_id, subject_id, section_id, school_year)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    learner_id INT NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
    school_year VARCHAR(20) NOT NULL,
    grades_visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (learner_id, school_year)
);

CREATE TABLE grade_items (
    id SERIAL PRIMARY KEY,
    faculty_load_id INT NOT NULL REFERENCES faculty_loads(id) ON DELETE CASCADE,
    trimester INT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
    component VARCHAR(10) NOT NULL CHECK (component IN ('WW', 'PT', 'EX')),
    item_name VARCHAR(100) NOT NULL,
    max_score NUMERIC(8,2) NOT NULL CHECK (max_score > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_scores (
    id SERIAL PRIMARY KEY,
    enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    grade_item_id INT NOT NULL REFERENCES grade_items(id) ON DELETE CASCADE,
    score NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (score >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (grade_item_id, enrollment_id)
);

CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    faculty_load_id INT NOT NULL REFERENCES faculty_loads(id) ON DELETE CASCADE,
    trimester INT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
    initial_grade NUMERIC(6,2),
    transmuted_grade INT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (enrollment_id, faculty_load_id, trimester)
);

CREATE TABLE school_calendar (
    id SERIAL PRIMARY KEY,
    school_year VARCHAR(20) NOT NULL,
    month_name VARCHAR(20) NOT NULL,
    total_days INT NOT NULL CHECK (total_days >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (school_year, month_name)
);

CREATE TABLE monthly_attendance (
    id SERIAL PRIMARY KEY,
    learner_id INT NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    month_name VARCHAR(20) NOT NULL,
    days_absent INT NOT NULL DEFAULT 0 CHECK (days_absent >= 0),
    days_tardy INT NOT NULL DEFAULT 0 CHECK (days_tardy >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (learner_id, school_year, month_name)
);

CREATE TABLE core_values_grades (
    id SERIAL PRIMARY KEY,
    learner_id INT NOT NULL REFERENCES learner_profiles(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    trimester INT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
    md_1 VARCHAR(5),
    md_2 VARCHAR(5),
    mt_1 VARCHAR(5),
    mt_2 VARCHAR(5),
    mk_1 VARCHAR(5),
    mb_1 VARCHAR(5),
    mb_2 VARCHAR(5),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (learner_id, school_year, trimester)
);

CREATE TABLE carousel_images (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE school_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_learner_profiles_grade_level ON learner_profiles(grade_level);
CREATE INDEX idx_enrollments_section_year ON enrollments(section_id, school_year);
CREATE INDEX idx_faculty_loads_school_year ON faculty_loads(school_year);
CREATE INDEX idx_grade_items_load_trimester ON grade_items(faculty_load_id, trimester);
CREATE INDEX idx_grades_enrollment_trimester ON grades(enrollment_id, trimester);

COMMIT;
