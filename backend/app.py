from flask import Flask, redirect, url_for, session, render_template
from datetime import datetime, timedelta
import threading
import time
from .database import init_db
from .auth import auth_bp
from .routes import followups_bp, dashboard_bp
from .models import get_db_connection, update_followup_status
import os

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), '../frontend/static'),
            template_folder=os.path.join(os.path.dirname(__file__), '../frontend/templates'))

# Generate a strong, random secret key for session management
app.secret_key = os.urandom(24)

# Initialize the database
init_db()

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(followups_bp, url_prefix='/api/followups')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')


# --- Background task for marking missed follow-ups ---
def check_missed_followups():
    with app.app_context():
        conn = get_db_connection()
        cursor = conn.cursor()
        now_str = datetime.now().isoformat()

        cursor.execute("""
            UPDATE follow_ups
            SET status = 'Missed'
            WHERE followup_datetime < ? AND status = 'Pending';
        """, (now_str,))
        conn.commit()
        conn.close()
    # print(f"Background task: Checked for missed follow-ups at {datetime.now()}")

def start_missed_followup_checker():
    # Run every 5 minutes (300 seconds)
    interval = 300
    while True:
        check_missed_followups()
        time.sleep(interval)

# Start the background thread when the app starts
thread = threading.Thread(target=start_missed_followup_checker, daemon=True)
thread.start()
# ---------------------------------------------------


# Route to serve the main HTML pages
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login')
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/followups')
def followups_page():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('followups.html')

@app.context_processor
def inject_user_data():
    """Inject user data into all templates."""
    user_id = session.get('user_id')
    username = session.get('username')
    role = session.get('role')
    return dict(current_user_id=user_id, current_username=username, current_user_role=role)
