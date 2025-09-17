# {{ project_name }}

A Frappe-based application to schedule interviews by fetching an interviewer's availability from **Microsoft Outlook/Teams Calendar** using **Microsoft Graph API**.

---

## Features

- Schedule interviews by selecting **interviewer email** and **interview date**.  
- Fetch busy intervals from **Microsoft Graph API** (`getSchedule`).  
- Displays a **visual schedule** with hourly slots (6 AM – 6 PM).  
- Shows **only accepted meetings**.  
- Clean, responsive design with dark theme and clear event blocks.  
- Calculates and displays **free time slots** (optional).  
- Handles API response safely, even with missing or partial data.  

---

## Installation

1. Clone the repository:

```bash
git clone {{ repo_url }}
cd {{ project_folder }}
