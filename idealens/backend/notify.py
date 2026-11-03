"""In-app notifications + optional e-mail (SMTP). E-mail problems never break a request."""
import smtplib, threading, uuid, datetime as dt
from email.message import EmailMessage
from . import config


def email_enabled():
    return bool(config.SMTP_HOST)


def _send(to, subject, body):
    try:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = config.SMTP_FROM, to, subject
        msg.set_content(body)
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as s:
            s.starttls()
            if config.SMTP_USER:
                s.login(config.SMTP_USER, config.SMTP_PASSWORD)
            s.send_message(msg)
    except Exception as e:
        print(f"[IdeaLens] e-mail failed: {e}")


def send_email(to, subject, body):
    if email_enabled() and to:
        threading.Thread(target=_send, args=(to, subject, body), daemon=True).start()
        return True
    return False


def push(store, user_id, title, text, link=""):
    """Create an in-app notification (and e-mail it when SMTP is configured)."""
    store.add_notification({"id": uuid.uuid4().hex, "user_id": user_id, "title": title, "text": text,
                            "link": link, "read": False,
                            "created_at": dt.datetime.now(dt.timezone.utc).isoformat()})
    if email_enabled():
        u = store.user_by_id(user_id)
        if u and u.get("email"):
            send_email(u["email"], "IdeaLens: " + title, f"{text}\n\nOpen: {config.APP_URL}/#{link or '/notifications'}")
