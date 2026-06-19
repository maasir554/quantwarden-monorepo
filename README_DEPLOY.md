# 🚀 QuantWarden Deployment Guide

This guide will help you get the entire QuantWarden platform up and running on your VM using a single command. 

---

## 📋 Prerequisites
Ensure you have the following installed on your machine/VM:
1. **Docker**
2. **Docker Compose**

---

## 🚀 How to Start the Project

Follow these steps exactly to start the platform:

### 1. Extract the Files
Unzip the `pnbhack-submission.zip` file on your server.
```bash
unzip pnbhack-submission.zip -d quantwarden
cd quantwarden
```

### 2. Set Up Environment Variables
Copy the example environment file to create your active configuration:
```bash
cp .env.example .env
```
> **Note:** The default `.env` works out of the box with **zero third-party services** — no Google, no email SaaS. Authentication and email are covered in [Authentication & Email](#-authentication--email) below.

### 3. Launch the Platform
Run this command to build and start all services (Database, UI, Worker, and APIs):
```bash
docker-compose up -d --build
```

---

## 🔍 How to Access & Verify

Once the command finishes, you can access the platform:
- **Web UI:** Open `http://<your-vm-ip>:3000` in your browser.
- **Mailpit (demo inbox):** Open `http://<your-vm-ip>:8025` to view every email the app sends (OTP codes, invites).
- **Backend APIs:** Various services are running on ports `8000`, `8002`, `8010`, `8020`, and `8085`.

> Auth URLs default to `http://localhost:3000`. If you access the app from another machine, set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` in `.env` to `http://<your-vm-ip>:3000` (or use an SSH tunnel) before `docker-compose up`.

---

## 🔐 Authentication & Email

QuantWarden runs with **no third-party services**. There are two ways to sign in, and they work side by side:

**1. Guest accounts (email-free) — works out of the box, nothing to configure.**
On the login/signup screen choose **Guest**, pick a username + password, and you're in. Guest accounts are full first-class accounts: they can be invited to organizations, hold any role (RBAC), and use every feature. Team invites to a guest are delivered to the invitee's **in-app inbox** — no email involved. If a guest forgets their password, an org admin resets it from **Team Management → member → Reset Password**.

**2. Email accounts (OTP / magic-link) — optional, needs SMTP.**
Email sign-in sends a 6-digit code over SMTP. This is **optional** and controlled by one variable:

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST` | SMTP relay host. **Unset it to disable email entirely** (guest-only). |
| `SMTP_PORT` | SMTP port (default `587`; Mailpit uses `1025`). |
| `SMTP_SECURE` | `true` for implicit TLS (port 465), else STARTTLS. |
| `SMTP_USER` / `SMTP_PASS` | Optional — many internal relays need no auth. |
| `SMTP_FROM` | From address for outgoing mail. |
| `GUEST_AUTH_ENABLED` | `true`/`false` to show/hide guest login (default `true`). |
| `GUEST_EMAIL_DOMAIN` | Internal domain used to back guest usernames (default `guest.local`). |

**Three deployment tiers, same code:**
- **Demo (default):** the bundled **Mailpit** container catches all mail — see it at `:8025`, no real mail server or credentials needed.
- **Production on your metal:** point `SMTP_HOST` at your internal mail relay (Exchange / Postfix). Recipients are internal, so SPF/DKIM/reputation don't apply.
- **Fully air-gapped:** unset `SMTP_HOST` (and remove the `mailpit` service) → the app runs **guest-only** with zero email.

---

## 🛠 Common Management Commands

Here are the commands you might need to manage the deployment:

### View Running Services
Check if everything is "Up":
```bash
docker-compose ps
```

### View Logs (Troubleshooting)
If something isn't working, check the logs:
```bash
docker-compose logs -f
```

### Stop the Platform
To stop all services:
```bash
docker-compose stop
```

### Stop and Remove Everything
To shut down and clean up the containers:
```bash
docker-compose down
```

### Update the Project
If you make changes to the code and want to apply them:
```bash
docker-compose up -d --build
```

---

## 📁 Project Structure
- `quantwarden-ui-main/`: Next.js Frontend & Scan Worker.
- `quantwarden-backend-main/`: Python & Go Microservices (Nmap, OpenSSL, Subfinder, etc.).
- `docker-compose.yml`: The master controller for the entire stack.
