import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app

if __name__ == '__main__':
    # Run the Flask application
    app.run(debug=True, port=5000)
