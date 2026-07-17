# QuantWarden Deployment Guide

Run the full QuantWarden stack on a VM with Docker Compose.

## Prerequisites
Install Docker and Docker Compose first.

## How to Start the Project

### 1. Extract the files
Unzip the `pnbhack-submission.zip` file on your server.
```bash
unzip pnbhack-submission.zip -d quantwarden
cd quantwarden
```

### 2. Create the configuration
```bash
cp .env.example .env
```
The defaults use username/password authentication and require no email service.

### 3. Launch the platform
```bash
docker-compose up -d --build
```

## Access

Once the command finishes, you can access the platform:
- **Web UI:** Open `http://<your-vm-ip>:3000` in your browser.
- **Mailpit (optional email testing):** `http://<your-vm-ip>:8025`
- **Backend APIs:** Various services are running on ports `8000`, `8002`, `8010`, `8020`, and `8085`.

> Auth URLs default to `http://localhost:3000`. If you access the app from another machine, set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` in `.env` to `http://<your-vm-ip>:3000` (or use an SSH tunnel) before `docker-compose up`.

## Authentication & Email

Username/password is the default and only visible sign-in method. Username invitations appear in the recipient's in-app inbox. An organization admin can reset a username account's password from Team Management.

Email OTP/magic-link authentication is optional. To enable it, set `EMAIL_AUTH_ENABLED=true`, configure SMTP, and rebuild:

```bash
docker-compose up -d --build
```

| Variable | Meaning |
| --- | --- |
| `USERNAME_AUTH_ENABLED` | Username/password sign-in; default `true`. |
| `USERNAME_EMAIL_DOMAIN` | Internal synthetic-email domain; default `guest.local`. |
| `EMAIL_AUTH_ENABLED` | Enables email sign-in and email invitations; default `false`. |
| `SMTP_HOST` | SMTP relay host. |
| `SMTP_PORT` | SMTP port (default `587`; Mailpit uses `1025`). |
| `SMTP_SECURE` | `true` for implicit TLS (port 465), else STARTTLS. |
| `SMTP_USER` / `SMTP_PASS` | Optional — many internal relays need no auth. |
| `SMTP_FROM` | From address for outgoing mail. |

## Common Management Commands

### View services
```bash
docker-compose ps
```

### View logs
```bash
docker-compose logs -f
```

### Stop
```bash
docker-compose stop
```

### Remove containers
```bash
docker-compose down
```

### Rebuild after changes
```bash
docker-compose up -d --build
```

## Project Structure
- `quantwarden-ui-main/`: Next.js Frontend & Scan Worker.
- `quantwarden-backend-main/`: Python & Go Microservices (Nmap, OpenSSL, Subfinder, etc.).
- `docker-compose.yml`: The master controller for the entire stack.
