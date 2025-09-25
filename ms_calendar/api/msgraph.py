import frappe, requests
from datetime import timedelta
from frappe.utils import get_datetime

@frappe.whitelist()
def get_schedule_free_slots(interviewer_emails, interview_date):
    """
    Fetches busy intervals for multiple interviewers using MS Graph getSchedule endpoint.
    interviewer_emails can be a Python list or JSON string like '["a@x.com","b@x.com"]'.
    """
    if isinstance(interviewer_emails, str):
        try:
            import json
            interviewer_emails = json.loads(interviewer_emails)
        except Exception:
            interviewer_emails = [interviewer_emails]

    if not isinstance(interviewer_emails, list) or not interviewer_emails:
        frappe.throw("interviewer_emails must be a non-empty list of email IDs")

    try:
        credentials = frappe.get_single("MS Graph Credentials")
        tenant_id = credentials.tenant_id
        client_id = credentials.client_id
        try:
            client_secret = credentials.get_password("client_secret")
        except frappe.ValidationError:
            frappe.throw(
                "Could not decrypt MS Graph client_secret. "
                "⚠️ Please check that your site_config.json contains the correct encryption_key. "
                "If you recently migrated/restored this site and do not have the old encryption key, "
                "you must re-enter the client_secret in the MS Graph Credentials doctype."
            )
    except Exception as e:
        frappe.throw(f"Could not fetch MS Graph Credentials: {e}")

    start_date = get_datetime(interview_date)
    end_date = start_date + timedelta(days=1)

    # Get access token
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }

    try:
        token_resp = requests.post(token_url, data=token_data)
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")
        if not access_token:
            frappe.throw(f"Failed to fetch access token: {token_resp.json()}")
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Token request failed: {e}")

    # Use the first interviewer as the context user for getSchedule
    context_user = interviewer_emails[0]
    url = f"https://graph.microsoft.com/v1.0/users/{context_user}/calendar/getSchedule"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    body = {
        "schedules": interviewer_emails,
        "startTime": {
            "dateTime": start_date.isoformat(),
            "timeZone": "UTC"
        },
        "endTime": {
            "dateTime": end_date.isoformat(),
            "timeZone": "UTC"
        },
        "availabilityViewInterval": 30
    }

    try:
        resp = requests.post(url, headers=headers, json=body)
        resp.raise_for_status()
        schedules = resp.json().get("value", [])
        result = {
            s["scheduleId"]: s.get("scheduleItems", [])
            for s in schedules
        }
        return result
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Graph API error: {resp.status_code} - {resp.text}")


import frappe, requests, uuid

@frappe.whitelist()
def create_calendar_event(event_title, start_datetime, end_datetime, interviewer_email, interviewee_email):
    """
    Schedules a new calendar event using Microsoft Graph (HR as organizer),
    and sends different custom emails to interviewer and candidate.
    """
    # --- 1. Get credentials ---
    try:
        credentials = frappe.get_single("MS Graph Credentials")
        tenant_id = credentials.tenant_id.strip()
        client_id = credentials.client_id.strip()
        client_secret = credentials.get_password("client_secret")
    except Exception as e:
        frappe.throw(f"Could not fetch MS Graph Credentials: {e}")
    
    # --- 2. Get access token ---
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }
    
    try:
        token_resp = requests.post(token_url, data=token_data).json()
        access_token = token_resp.get("access_token")
        if not access_token:
            frappe.throw(f"Failed to fetch access token: {token_resp}")
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Token request failed: {e}")

    # --- 3. Organizer email (HR official mailbox) ---
    organizer_email = "health.fellowship@azimpremjifoundation.org"   # 👈 replace with your official organizer email
    url = f"https://graph.microsoft.com/v1.0/users/{organizer_email}/events?sendUpdates=none"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # --- 4. Event body (seen only by HR) ---
    event_body = {
        "subject": event_title,
        "start": {"dateTime": start_datetime, "timeZone": "Asia/Kolkata"},
        "end": {"dateTime": end_datetime, "timeZone": "Asia/Kolkata"},
        "location": {"displayName": "Microsoft Teams Meeting"},
        "attendees": [
            {"emailAddress": {"address": interviewer_email, "name": "Interviewer"}, "type": "required"},
            {"emailAddress": {"address": interviewee_email, "name": "Candidate"}, "type": "required"}
        ],
        "responseRequested": True,
        "allowNewTimeProposals": True,
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
        "transactionId": str(uuid.uuid4()),
        "body": {
            "contentType": "HTML",
            "content": f"""
                <p>Dear HR,</p>
                <p>This interview has been scheduled via the system.</p>
                <p><b>Title:</b> {event_title}<br>
                <b>Start:</b> {start_datetime}<br>
                <b>End:</b> {end_datetime}<br>
                <b>Location:</b> Microsoft Teams Meeting</p>
            """
        }
    }

    # --- 5. Create event ---
    try:
        resp = requests.post(url, headers=headers, json=event_body)
        resp.raise_for_status()
        event = resp.json()
        join_url = event.get("onlineMeeting", {}).get("joinUrl")

        # --- 6. Send custom email to Interviewer ---
        frappe.sendmail(
            recipients=[interviewer_email],
            subject=f"Interview Scheduled (Interviewer) - {event_title}",
            message=f"""
                <p>Dear Interviewer,</p>
                <p>You are scheduled to conduct an interview.</p>
                <p><b>Title:</b> {event_title}<br>
                   <b>Start:</b> {start_datetime}<br>
                   <b>End:</b> {end_datetime}<br>
                   <b>Join Link:</b> <a href="{join_url}">Join Teams Meeting</a></p>
                <p>Please be on time and review the candidate details before the meeting.</p>
                <p>Best regards,<br>HR Team</p>
            """
        )

        # --- 7. Send custom email to Candidate ---
        frappe.sendmail(
            recipients=[interviewee_email],
            subject=f"Interview Invitation - {event_title}",
            message=f"""
                <p>Dear Candidate,</p>
                <p>Your interview has been scheduled.</p>
                <p><b>Title:</b> {event_title}<br>
                   <b>Start:</b> {start_datetime}<br>
                   <b>End:</b> {end_datetime}<br>
                   <b>Join Link:</b> <a href="{join_url}">Join Teams Meeting</a></p>
                <p>Please ensure you are in a quiet place with stable internet connectivity.</p>
                <p>Best regards,<br>HR Team</p>
            """
        )

        frappe.msgprint("Interview scheduled. HR notified, and custom invites sent to interviewer and candidate.")

        return {"event_id": event.get("id"), "join_url": join_url}
    
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Graph API error: {resp.status_code} - {resp.text}")




import frappe
import requests
from frappe.utils import get_datetime
from datetime import datetime, timezone, timedelta
import time  

@frappe.whitelist()
def get_org_rooms_and_availability(interview_date, start_time, end_time):
    """
    Fetch all rooms and their availability for the given date and time range.
    Uses system timezone detected automatically.
    """

    # -------------------------
    # STEP 1: Fetch MS Graph Credentials
    # -------------------------
    credentials = frappe.get_single("MS Graph Credentials")
    tenant_id = credentials.tenant_id
    client_id = credentials.client_id
    client_secret = credentials.get_password("client_secret")

    # -------------------------
    # STEP 2: Get Access Token
    # -------------------------
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }
    token_resp = requests.post(token_url, data=token_data)
    token_resp.raise_for_status()
    access_token = token_resp.json().get("access_token")

    headers = {"Authorization": f"Bearer {access_token}"}

    # -------------------------
    # STEP 3: Fetch All Rooms
    # -------------------------
    rooms_url = "https://graph.microsoft.com/v1.0/places/microsoft.graph.room"
    rooms_resp = requests.get(rooms_url, headers=headers)
    rooms_resp.raise_for_status()
    rooms = rooms_resp.json().get("value", [])
    room_emails = [r["emailAddress"] for r in rooms if "emailAddress" in r]

    # -------------------------
    # STEP 4: Build DateTime Range (convert to UTC)
    # -------------------------
    # detect system timezone offset
    offset_sec = -time.timezone if (time.localtime().tm_isdst == 0) else -time.altzone
    system_tz = timezone(timedelta(seconds=offset_sec))

    start_dt_local = get_datetime(f"{interview_date} {start_time}")
    end_dt_local = get_datetime(f"{interview_date} {end_time}")

    # Localize and convert to UTC
    start_dt_utc = start_dt_local.replace(tzinfo=system_tz).astimezone(timezone.utc)
    end_dt_utc = end_dt_local.replace(tzinfo=system_tz).astimezone(timezone.utc)

    # -------------------------
    # STEP 5: Fetch Availability
    # -------------------------
    schedule_url = "https://graph.microsoft.com/v1.0/users/health.fellowship@azimpremjifoundation.org/calendar/getSchedule"
    body = {
        "schedules": room_emails,
        "startTime": {"dateTime": start_dt_utc.isoformat(), "timeZone": "UTC"},
        "endTime": {"dateTime": end_dt_utc.isoformat(), "timeZone": "UTC"},
        "availabilityViewInterval": 30
    }
    schedule_resp = requests.post(
        schedule_url,
        headers={**headers, "Content-Type": "application/json"},
        json=body
    )
    schedule_resp.raise_for_status()
    availability_data = schedule_resp.json().get("value", [])

    # -------------------------
    # STEP 6: Merge Rooms + Availability
    # -------------------------
    availability_map = {a.get("scheduleId"): a.get("scheduleItems", []) for a in availability_data}
    rooms_list = []

    for room in rooms:
        email = room.get("emailAddress")
        busy_slots = availability_map.get(email, [])
        is_available = True

        for slot in busy_slots:
            slot_start = datetime.fromisoformat(slot["start"]["dateTime"]).replace(tzinfo=timezone.utc)
            slot_end = datetime.fromisoformat(slot["end"]["dateTime"]).replace(tzinfo=timezone.utc)

            if not (slot_end <= start_dt_utc or slot_start >= end_dt_utc):
                is_available = False
                break

        rooms_list.append({
            "name": room.get("displayName"),
            "email": email,
            "capacity": room.get("capacity", ""),
            "availability": busy_slots,
            "is_available": is_available
        })

    return {"rooms": rooms_list}



import frappe
import requests
import uuid
from datetime import datetime
from requests.exceptions import RequestException
import os
import ast

@frappe.whitelist()
def create_interview_event(event_title, start_datetime, end_datetime, interviewer_emails, interviewee_email,  room_emails, attachment_paths=None):
    # --- 1. Get credentials ---
    print("DEBUG: Received attachment_paths:", attachment_paths)
    frappe.log_error(message=f"Received attachment_paths: {attachment_paths}", title="Attachment Debug")
    print("DEBUG: Received room_emails:", room_emails)
    frappe.log_error(message=f"Received room_emails: {room_emails}", title="Room Email Debug")

    try:
        credentials = frappe.get_single("MS Graph Credentials")
        tenant_id = credentials.tenant_id.strip()
        client_id = credentials.client_id.strip()
        client_secret = credentials.get_password("client_secret")
    except Exception as e:
        frappe.throw(f"Could not fetch MS Graph Credentials: {e}")

    # --- 2. Get access token ---
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }

    try:
        token_resp = requests.post(token_url, data=token_data, timeout=10)
        token_resp.raise_for_status()
        token_json = token_resp.json()
        access_token = token_json.get("access_token")
        if not access_token:
            frappe.throw(f"Failed to fetch access token: {token_json}")
    except RequestException as e:
        frappe.throw(f"Token request failed. Check server internet/DNS connection: {e}")

     # --- 3. Prepare rooms ---
    room_list = [r.strip() for r in room_emails.split(",") if r.strip()]
    room_list_text = ", ".join(room_list)

    start_str = datetime.fromisoformat(start_datetime).strftime("%I:%M %p, %d %b %Y")
    end_str = datetime.fromisoformat(end_datetime).strftime("%I:%M %p, %d %b %Y")

    # --- 4. Create event in organizer calendar ---
    organizer_email = "health.fellowship@azimpremjifoundation.org"
    url = f"https://graph.microsoft.com/v1.0/users/{organizer_email}/events?sendUpdates=none"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    calendar_body_content = f"""
        <p>Dear HR,</p>
        <p>The interview has been scheduled.</p>
        <p><b>Title:</b> {event_title}<br>
           <b>Start:</b> {start_str}<br>
           <b>End:</b> {end_str}<br>
           <b>Rooms:</b> {room_list_text}</p>
        <p>Please follow up with interviewers and candidate.</p>
        <p>Best regards,<br>HR Team</p>
    """
    # Prepare room attendees for MS Graph
    room_attendees = []
    if room_emails:
        room_list = [r.strip() for r in room_emails.split(",") if r.strip()]
        for room in room_list:
            room_attendees.append({
                "emailAddress": {"address": room, "name": room},
                "type": "resource"  # important: type resource = room booking
            })

    # Prepare interviewer attendees (optional: if you want them to appear in calendar)
    interviewer_list = [email.strip() for email in interviewer_emails.split(",") if email.strip()]
    interviewer_attendees = [
        {"emailAddress": {"address": intr, "name": intr}, "type": "required"}
        for intr in interviewer_list
    ]

    # Merge attendees
    all_attendees = room_attendees

    frappe.log_error(message=f"Room attendees payload: {room_attendees}", title="Room Debug")
    print("DEBUG: Room attendees payload:", room_attendees)
    event_body = {
        "subject": event_title,
        "start": {"dateTime": start_datetime, "timeZone": "Asia/Kolkata"},
        "end": {"dateTime": end_datetime, "timeZone": "Asia/Kolkata"},
        "location": {"displayName": "Microsoft Teams Meeting"},
        "responseRequested": False,
        "allowNewTimeProposals": False,
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
        "transactionId": str(uuid.uuid4()),
        "body": {"contentType": "HTML", "content": calendar_body_content},
        "attendees": all_attendees  # <-- this blocks the rooms automatically

    }

    try:
        resp = requests.post(url, headers=headers, json=event_body, timeout=10)
        resp.raise_for_status()
        event = resp.json()
        join_url = event.get("onlineMeeting", {}).get("joinUrl")
    except RequestException as e:
        frappe.throw(f"Graph API event creation failed: {e}")

    for intr in interviewer_list:
        intr_url = f"https://graph.microsoft.com/v1.0/users/{intr}/events?sendUpdates=none"

        # Copy event body but remove self-attendance
        intr_event_body = event_body.copy()
        intr_event_body["attendees"] = room_attendees  # only rooms, not interviewers

        try:
            intr_resp = requests.post(intr_url, headers=headers, json=intr_event_body, timeout=10)
            intr_resp.raise_for_status()
            frappe.log_error(message=f"Event created in {intr}'s calendar", title="Interviewer Calendar")
        except RequestException as e:
            frappe.log_error(message=f"Failed to create event in {intr}'s calendar: {e}", title="Interviewer Calendar Error")

    # --- 5. Prepare attachment for Frappe email ---

    if attachment_paths and isinstance(attachment_paths, str):
        try:
            attachment_paths = ast.literal_eval(attachment_paths)
        except Exception as e:
            frappe.log_error(message=f"Failed to parse attachment_paths: {attachment_paths}\nError: {e}", title="Attachment Debug")
            attachment_paths = []
    attachments = []
    if attachment_paths:
        for path in attachment_paths:
            if not path:
                continue

            if path.startswith("/files/"):
                relative_path = path[len("/files/"):]
                file_path = frappe.get_site_path("public", "files", relative_path)
            else:
                file_path = path

            if os.path.isfile(file_path):
                with open(file_path, "rb") as f:
                    fcontent = f.read()
                attachments.append({"fname": os.path.basename(file_path), "fcontent": fcontent})
            else:
                frappe.log_error(message=f"Skipped non-file path: {file_path}", title="Attachment Debug")


    # --- 6. Send emails to interviewers ---
    interviewer_list = [email.strip() for email in interviewer_emails.split(",") if email.strip()]
    for intr_email in interviewer_list:  # <-- remove enumerate
        email_body = f"""
            <p>Dear Interviewer ,</p>
            <p>You are scheduled to conduct an interview.</p>
            <p><b>Title:</b> {event_title}<br>
            <b>Start:</b> {start_str}<br>
            <b>End:</b> {end_str}<br>
            <b>Rooms:</b> {room_list_text}<br>
            <b>Join Link:</b> <a href="{join_url}">Join Teams Meeting</a></p>
            <p>Please review candidate details before the meeting.</p>
            <p>Best regards,<br>HR Team</p>
        """
    frappe.sendmail(
        recipients=[intr_email],
        subject=f"Interview Scheduled - {event_title}",
        message=email_body,
        now=True,
        attachments=attachments
    )

    # --- 7. Send email to candidate ---
    candidate_body = f"""
        <p>Dear Candidate,</p>
        <p>Your interview has been scheduled.</p>
        <p><b>Title:</b> {event_title}<br>
           <b>Start:</b> {start_str}<br>
           <b>End:</b> {end_str}<br>
           <b>Rooms:</b> {room_list_text}<br>
           <b>Join Link:</b> <a href="{join_url}">Join Teams Meeting</a></p>
        <p>Please ensure you are in a quiet place with stable internet connectivity.</p>
        <p>Best regards,<br>HR Team</p>
    """
    frappe.sendmail(
        recipients=[interviewee_email],
        subject=f"Interview Scheduled - {event_title}",
        message=candidate_body,
        now=True,
    )

    frappe.msgprint("✅ Interview scheduled. Custom emails sent.")
    return {"event_id": event.get("id"), "join_url": join_url}
