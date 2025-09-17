# MS Calendar Integration

A Frappe-based application to schedule interviews by fetching an interviewer's availability from Microsoft Outlook/Teams Calendar using Microsoft Graph API.

---

## Features

- Schedule interviews by selecting **interviewer email** and **interview date**.
- Fetch busy intervals from **Microsoft Graph API** (`getSchedule`).
- Displays a visual schedule with hourly slots (6 AM – 6 PM).
- Shows only accepted meetings.
- Clean, responsive design with a dark theme and clear event blocks.
- Calculates and displays **free time slots** (optional).
- Handles API response safely, even with missing or partial data.

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/augustinAPF/ms-calendar.git
   cd ms-calendar

Install dependencies and set up your Frappe environment:

bench init frappe-bench --frappe-branch develop
cd frappe-bench
bench get-app ms_calendar ../ms-calendar
bench new-site your-site.local
bench --site your-site.local install-app ms_calendar
bench start


## Configure MS Graph Credentials in Frappe:


Go to MS Graph Credentials doctype.
Add (tenant_id, client_id, and client_secret).

## Usage

Open the Schedule Interview doctype in Frappe.

Enter the interviewer email and interview date.

Click Check Availability.

The schedule will display all accepted meetings for the selected date.
