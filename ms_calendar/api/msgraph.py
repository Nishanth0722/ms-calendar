import frappe, requests
from datetime import datetime, timedelta
from frappe.utils import get_datetime

@frappe.whitelist()
def get_schedule_free_slots(interviewer_email, interview_date):
    """
    Fetches an interviewer's busy intervals using Microsoft Graph getSchedule endpoint.
    """
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
            frappe.throw(f"Unexpected error fetching client_secret: {e}")

    except Exception as e:
        frappe.throw(f"Could not fetch MS Graph Credentials: {e}")

    start_date = get_datetime(interview_date)
    end_date = start_date + timedelta(days=1)

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
        token_json = token_resp.json()
        access_token = token_json.get("access_token")
        if not access_token:
            frappe.throw(f"Failed to fetch access token: {token_json}")
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Token request failed: {e}")

    url = f"https://graph.microsoft.com/v1.0/users/{interviewer_email}/calendar/getSchedule"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    body = {
        "schedules": [interviewer_email],
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
        schedule = resp.json().get("value", [])
        if schedule and schedule[0].get("scheduleItems"):
            return schedule[0]["scheduleItems"]
        return []
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Graph API error: {resp.status_code} - {resp.text}")

import frappe, requests, uuid

@frappe.whitelist()
def create_calendar_event(event_title, start_datetime, end_datetime, interviewer_email, interviewee_email):
    """
    Schedules a new calendar event using Microsoft Graph and sends meeting invites.
    """
    try:
        credentials = frappe.get_single("MS Graph Credentials")
        tenant_id = credentials.tenant_id.strip()
        client_id = credentials.client_id.strip()
        client_secret = credentials.get_password("client_secret")
    except Exception as e:
        frappe.throw(f"Could not fetch MS Graph Credentials: {e}")
    
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

    url = f"https://graph.microsoft.com/v1.0/users/{interviewer_email}/events?sendUpdates=all"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    event_body = {
        "subject": event_title,
        "start": {
            "dateTime": start_datetime,
            "timeZone": "Asia/Kolkata"
        },
        "end": {
            "dateTime": end_datetime,
            "timeZone": "Asia/Kolkata"
        },
        "location": {
            "displayName": "Microsoft Teams Meeting"
        },
        "attendees": [
            {
                "emailAddress": {"address": interviewer_email, "name": "Interviewer"},
                "type": "required"
            },
            {
                "emailAddress": {"address": interviewee_email, "name": "Candidate"},
                "type": "required"
            }
        ],
        "responseRequested": True,
        "allowNewTimeProposals": True,
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
        "transactionId": str(uuid.uuid4()) 
    }
    try:
        resp = requests.post(url, headers=headers, json=event_body)
        resp.raise_for_status()
        
        event = resp.json()
        frappe.msgprint("Interview scheduled and invites sent!")
        return {
            "event_id": event.get("id"),
            "join_url": event.get("onlineMeeting", {}).get("joinUrl")
        }
    
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Graph API error: {resp.status_code} - {resp.text}")