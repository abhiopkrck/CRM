from .database import get_db_connection
from datetime import datetime, timedelta


def add_followup(lead_id, customer_id, followup_type, followup_datetime,
                 priority, assigned_to, notes, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    status = 'Pending'

    try:
        cursor.execute("""
            INSERT INTO follow_ups (
                lead_id, customer_id, followup_type, followup_datetime,
                priority, status, assigned_to, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            lead_id, customer_id, followup_type, followup_datetime,
            priority, status, assigned_to, notes, now, now
        ))

        followup_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO followup_history
            (followup_id, action, remarks, action_date, acted_by)
            VALUES (?, ?, ?, ?, ?)
        """, (
            followup_id,
            'Created',
            'Follow-up created',
            now,
            user_id
        ))

        conn.commit()
        return followup_id

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def update_followup(followup_id, lead_id, customer_id, followup_type,
                    followup_datetime, priority, assigned_to, notes, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    try:
        cursor.execute("""
            UPDATE follow_ups
            SET lead_id = ?, customer_id = ?, followup_type = ?,
                followup_datetime = ?, priority = ?, assigned_to = ?,
                notes = ?, updated_at = ?
            WHERE id = ?
        """, (
            lead_id, customer_id, followup_type,
            followup_datetime, priority, assigned_to,
            notes, now, followup_id
        ))

        cursor.execute("""
            INSERT INTO followup_history
            (followup_id, action, remarks, action_date, acted_by)
            VALUES (?, ?, ?, ?, ?)
        """, (
            followup_id,
            'Updated',
            'Follow-up updated',
            now,
            user_id
        ))

        conn.commit()
        return True

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def update_followup_status(followup_id, new_status, user_id, remarks=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    try:
        cursor.execute("""
            UPDATE follow_ups
            SET status = ?, updated_at = ?
            WHERE id = ?
        """, (new_status, now, followup_id))

        cursor.execute("""
            INSERT INTO followup_history
            (followup_id, action, remarks, action_date, acted_by)
            VALUES (?, ?, ?, ?, ?)
        """, (
            followup_id,
            new_status,
            remarks,
            now,
            user_id
        ))

        conn.commit()
        return True

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_followup_history(followup_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT fh.*, u.username AS acted_by_username
        FROM followup_history fh
        LEFT JOIN users u ON fh.acted_by = u.id
        WHERE fh.followup_id = ?
        ORDER BY fh.action_date DESC
    """, (followup_id,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_followups(user_id, user_role):
    conn = get_db_connection()
    cursor = conn.cursor()

    if user_role == 'Admin':
        cursor.execute("""
            SELECT f.*, u.username AS assigned_username
            FROM follow_ups f
            JOIN users u ON f.assigned_to = u.id
            ORDER BY f.followup_datetime
        """)
    else:
        cursor.execute("""
            SELECT f.*, u.username AS assigned_username
            FROM follow_ups f
            JOIN users u ON f.assigned_to = u.id
            WHERE f.assigned_to = ?
            ORDER BY f.followup_datetime
        """, (user_id,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_followup_by_id(followup_id, user_id, user_role):
    conn = get_db_connection()
    cursor = conn.cursor()

    if user_role == 'Admin':
        cursor.execute("""
            SELECT f.*, u.username AS assigned_username
            FROM follow_ups f
            JOIN users u ON f.assigned_to = u.id
            WHERE f.id = ?
        """, (followup_id,))
    else:
        cursor.execute("""
            SELECT f.*, u.username AS assigned_username
            FROM follow_ups f
            JOIN users u ON f.assigned_to = u.id
            WHERE f.id = ? AND f.assigned_to = ?
        """, (followup_id, user_id))

    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_dashboard_data(user_id, user_role):
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now()
    now_str = now.isoformat()
    next_24h = (now + timedelta(hours=24)).isoformat()

    base = """
        SELECT f.*, u.username AS assigned_username
        FROM follow_ups f
        JOIN users u ON f.assigned_to = u.id
    """

    params = ()
    if user_role != 'Admin':
        base += " WHERE f.assigned_to = ?"
        params = (user_id,)

    cursor.execute(base + " AND f.status = 'Pending'", params)
    pending = [dict(r) for r in cursor.fetchall()]

    cursor.execute(
        base + " AND f.status = 'Pending' AND f.followup_datetime BETWEEN ? AND ?",
        params + (now_str, next_24h)
    )
    upcoming = [dict(r) for r in cursor.fetchall()]

    cursor.execute(base + " AND f.status = 'Missed'", params)
    missed = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "pending": pending,
        "upcoming": upcoming,
        "missed": missed,
        "pending_count": len(pending),
        "missed_count": len(missed)
    }


def get_lead_customer_history(identifier_type, identifier_value):
    conn = get_db_connection()
    cursor = conn.cursor()

    field = "lead_id" if identifier_type == "lead_id" else "customer_id"

    cursor.execute(f"""
        SELECT fh.*, u.username AS acted_by_username
        FROM followup_history fh
        JOIN follow_ups f ON fh.followup_id = f.id
        LEFT JOIN users u ON fh.acted_by = u.id
        WHERE f.{field} = ?
        ORDER BY fh.action_date DESC
    """, (identifier_value,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
