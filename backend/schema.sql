-- ==========================================
-- 1. INDEPENDENT TABLES (Create these first)
-- ==========================================

-- System Settings Table
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    current_school_year VARCHAR(20) NOT NULL,
    active_trisemester VARCHAR(20) NOT NULL
);

-- Users Table (Handles Admins, Faculties, Students, and Parents)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'ADMIN', 'FACULTY', 'LEARNER', 'PARENT'
    first_name VARCHAR(100),
    last_name VARCHAR(100)
);

-- Subjects Table
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    ww_weight INT NOT NULL,
    pt_weight INT NOT NULL,
    ex_weight INT NOT NULL
);

-- Sections Table
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    grade_level VARCHAR(50) NOT NULL,
    section_name VARCHAR(100) NOT NULL
);

-- ==========================================
-- 2. DEPENDENT TABLES (Contains Foreign Keys)
-- ==========================================

-- Section Advisories Table (Homeroom Advisers)
CREATE TABLE section_advisories (
    section_id INT REFERENCES sections(id) ON DELETE CASCADE,
    faculty_id INT REFERENCES users(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    PRIMARY KEY (section_id, school_year) -- Ensures a section only has 1 adviser per year
);

-- Faculty Loads Table (Subject Assignments)
CREATE TABLE faculty_loads (
    id SERIAL PRIMARY KEY,
    faculty_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    section_id INT REFERENCES sections(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL
);

-- Grades Table
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id INT REFERENCES users(id) ON DELETE CASCADE,
    trisemester VARCHAR(20) NOT NULL,
    school_year VARCHAR(20) NOT NULL,
    ww_score DECIMAL(5,2),
    pt_score DECIMAL(5,2),
    ex_score DECIMAL(5,2),
    final_grade DECIMAL(5,2)
);

-- ==========================================
-- 3. INITIAL DUMMY DATA (Optional but helpful)
-- ==========================================

-- Insert default system settings
INSERT INTO system_settings (current_school_year, active_trisemester) 
VALUES ('2026-2027', '1st');

-- Insert a default Admin user (Password is 'admin123' hashed with bcrypt)
INSERT INTO users (username, password_hash, role, first_name, last_name) 
VALUES ('admin', '$2b$10$7gFXleIMwGROA/93Oy7wzOJqK5unPqSlqqBQEQuv80Cy78fsy/Sh.', 'ADMIN', 'Super', 'Admin');