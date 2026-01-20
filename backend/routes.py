from flask import Blueprint, request, jsonify, session
from .auth import login_required, roles_required
from .models import (
    add_followup, update_followup, update_followup_status,
    get_followup_history, get_all_followups, get_followup_by_id,
    get_dashboard_data, get_lead_customer_history
)
from datetime import datetime

followups_bp = Blueprint('followups', __name__)
dashboard_bp = Blueprint('dashboard', __name__)

@followups_bp.route('/', methods=['POST'])
@login_required
@roles_required(['Admin', 'Sales Manager', 'Sales Executive'])
def create_followup():
    data = request.get_json()
    try:
        followup_id = add_followup(
            lead_id=data.get('lead_id'),
            customer_id=data.get('customer_id'),
            followup_type=data['followup_type'],
            followup_datetime=data['followup_datetime'],
            priority=data['priority'],
            assigned_to=data['assigned_to'],
            notes=data.get('notes'),
            user_id=session['user_id']
        )
        return jsonify({'message': 'Follow-up created successfully', 'id': followup_id}), 201
    except KeyError as e:
        return jsonify({'message': f'Missing required field: {e}'}), 400
    except Exception as e:
        return jsonify({'message': f'Error creating follow-up: {str(e)}'}), 500

@followups_bp.route('/', methods=['GET'])
@login_required
def get_followups():
    try:
        followups = get_all_followups(session['user_id'], session['role'])
        return jsonify(followups), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching follow-ups: {str(e)}'}), 500

@followups_bp.route('/<int:followup_id>', methods=['GET'])
@login_required
def get_single_followup(followup_id):
    try:
        followup = get_followup_by_id(followup_id, session['user_id'], session['role'])
        if not followup:
            return jsonify({'message': 'Follow-up not found or unauthorized'}), 404
        return jsonify(followup), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching follow-up: {str(e)}'}), 500

@followups_bp.route('/<int:followup_id>', methods=['PUT'])
@login_required
@roles_required(['Admin', 'Sales Manager', 'Sales Executive'])
def edit_followup(followup_id):
    data = request.get_json()
    try:
        # Check if the user is authorized to update this specific follow-up
        existing_followup = get_followup_by_id(followup_id, session['user_id'], session['role'])
        if not existing_followup:
            return jsonify({'message': 'Follow-up not found or unauthorized'}), 404

        success = update_followup(
            followup_id,
            lead_id=data.get('lead_id'),
            customer_id=data.get('customer_id'),
            followup_type=data['followup_type'],
            followup_datetime=data['followup_datetime'],
            priority=data['priority'],
            assigned_to=data['assigned_to'],
            notes=data.get('notes'),
            user_id=session['user_id']
        )
        if success:
            return jsonify({'message': 'Follow-up updated successfully'}), 200
        else:
            return jsonify({'message': 'Failed to update follow-up'}), 500
    except KeyError as e:
        return jsonify({'message': f'Missing required field: {e}'}), 400
    except ValueError as e:
        return jsonify({'message': str(e)}), 404
    except Exception as e:
        return jsonify({'message': f'Error updating follow-up: {str(e)}'}), 500

@followups_bp.route('/<int:followup_id>/status', methods=['PUT'])
@login_required
@roles_required(['Admin', 'Sales Manager', 'Sales Executive'])
def change_followup_status(followup_id):
    data = request.get_json()
    new_status = data.get('status')
    remarks = data.get('remarks', '')

    if not new_status or new_status not in ['Completed', 'Pending', 'Rescheduled', 'Missed']:
        return jsonify({'message': 'Invalid status provided'}), 400

    try:
        # Check if the user is authorized to update this specific follow-up
        existing_followup = get_followup_by_id(followup_id, session['user_id'], session['role'])
        if not existing_followup:
            return jsonify({'message': 'Follow-up not found or unauthorized'}), 404

        # For 'Missed' status, only Admin/Manager can set it directly, otherwise it's set by background task
        if new_status == 'Missed' and session['role'] not in ['Admin', 'Sales Manager']:
             return jsonify({'message': 'Only Admin or Sales Manager can directly mark a follow-up as Missed.'}), 403

        success = update_followup_status(followup_id, new_status, session['user_id'], remarks)
        if success:
            return jsonify({'message': f'Follow-up status updated to {new_status}'}), 200
        else:
            return jsonify({'message': 'Failed to update follow-up status'}), 500
    except Exception as e:
        return jsonify({'message': f'Error updating follow-up status: {str(e)}'}), 500

@followups_bp.route('/<int:followup_id>/history', methods=['GET'])
@login_required
def get_history(followup_id):
    try:
        # Ensure user can view this followup before showing history
        existing_followup = get_followup_by_id(followup_id, session['user_id'], session['role'])
        if not existing_followup:
            return jsonify({'message': 'Follow-up not found or unauthorized'}), 404

        history = get_followup_history(followup_id)
        return jsonify(history), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching follow-up history: {str(e)}'}), 500

@dashboard_bp.route('/', methods=['GET'])
@login_required
def get_user_dashboard_data():
    try:
        data = get_dashboard_data(session['user_id'], session['role'])
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching dashboard data: {str(e)}'}), 500

@followups_bp.route('/history_by_entity', methods=['GET'])
@login_required
def get_entity_history():
    lead_id = request.args.get('lead_id')
    customer_id = request.args.get('customer_id')

    if not lead_id and not customer_id:
        return jsonify({'message': 'Either lead_id or customer_id must be provided'}), 400

    try:
        if lead_id:
            history = get_lead_customer_history('lead_id', lead_id)
        else: # customer_id
            history = get_lead_customer_history('customer_id', customer_id)

        return jsonify(history), 200
    except Exception as e:
        return jsonify({'message': f'Error fetching entity history: {str(e)}'}), 500