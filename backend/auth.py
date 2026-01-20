from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from .models import get_db_connection
from functools import wraps

auth_bp = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Unauthorized', 'code': 401}), 401
        return f(*args, **kwargs)
    return decorated_function

def roles_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                return jsonify({'message': 'Forbidden', 'code': 403}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@auth_bp.route('/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'Sales Executive') # Default role

    if not username or not password or not role:
        return jsonify({'message': 'Missing username, password, or role'}), 400

    hashed_password = generate_password_hash(password)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                       (username, hashed_password, role))
        conn.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'message': f'Error registering user: {str(e)}'}), 500
    finally:
        conn.close()

@auth_bp.route('/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Missing username or password'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        return jsonify({'message': 'Login successful', 'role': user['role']}), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout_user():
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('role', None)
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        'user_id': session['user_id'],
        'username': session['username'],
        'role': session['role']
    }), 200

@auth_bp.route('/users', methods=['GET'])
@login_required
@roles_required(['Admin', 'Sales Manager'])
def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role FROM users")
    users = cursor.fetchall()
    conn.close()
    return jsonify([dict(u) for u in users]), 200
