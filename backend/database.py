import sqlite3
import os
from werkzeug.security import generate_password_hash

DATABASE = 'crm_followup.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Sales Executive' -- Admin, Sales Manager, Sales Executive
        );
    """)

    # Create follow_ups table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS follow_ups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id TEXT,
            customer_id TEXT,
            followup_type TEXT NOT NULL, -- Call, Meeting, Visit, Task
            followup_datetime TEXT NOT NULL, -- ISO format
            priority TEXT NOT NULL, -- Low, Medium, High
            status TEXT NOT NULL, -- Pending, Completed, Missed, Rescheduled
            assigned_to INTEGER NOT NULL, -- FK to users.id
            notes TEXT,
            created_at TEXT NOT NULL, -- ISO format
            updated_at TEXT NOT NULL, -- ISO format
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        );
    """)

    # Create followup_history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS followup_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            followup_id INTEGER NOT NULL, -- FK to follow_ups.id
            action TEXT NOT NULL, -- e.g., 'Created', 'Updated', 'Completed', 'Rescheduled', 'Missed', 'Notes Added'
            remarks TEXT,
            action_date TEXT NOT NULL, -- ISO format
            acted_by INTEGER, -- FK to users.id, who performed the action
            FOREIGN KEY (followup_id) REFERENCES follow_ups(id),
            FOREIGN KEY (acted_by) REFERENCES users(id)
        );
    """)

    # Insert default admin user if not exists
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        admin_password_hash = generate_password_hash('admin123')
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                       ('admin', admin_password_hash, 'Admin'))
        print("Default Admin user created (username: admin, password: admin123)")

    # Insert default sales manager user if not exists
    cursor.execute("SELECT id FROM users WHERE username = 'manager'")
    if not cursor.fetchone():
        manager_password_hash = generate_password_hash('manager123')
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                       ('manager', manager_password_hash, 'Sales Manager'))
        print("Default Sales Manager user created (username: manager, password: manager123)")

    # Insert default sales executive user if not exists
    cursor.execute("SELECT id FROM users WHERE username = 'executive1'")
    if not cursor.fetchone():
        executive_password_hash = generate_password_hash('exec123')
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                       ('executive1', executive_password_hash, 'Sales Executive'))
        print("Default Sales Executive user created (username: executive1, password: exec123)")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    # This block runs when database.py is executed directly for setup
    init_db()
    print(f"Database '{DATABASE}' initialized and default users created.")
