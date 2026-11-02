# Gmail SMTP Setup Guide for FitVibe

> **Purpose**: Configure Gmail SMTP to enable email functionality (registration, password reset, notifications)
> **Difficulty**: Easy
> **Time Required**: 10-15 minutes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Gmail App Password Setup](#gmail-app-password-setup)
3. [Environment Configuration](#environment-configuration)
4. [Testing Email Functionality](#testing-email-functionality)
5. [Troubleshooting](#troubleshooting)
6. [Alternative Email Providers](#alternative-email-providers)

---

## Prerequisites

- Gmail account (personal or Google Workspace)
- 2-Factor Authentication (2FA) enabled on Gmail
- FitVibe backend running locally or deployed

---

## Gmail App Password Setup

### Why App Passwords?

Google no longer allows "less secure app access". You must use App Passwords, which are 16-character passwords that let apps and devices access your Gmail account.

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click **2-Step Verification**
3. Follow the prompts to enable 2FA (if not already enabled)
4. Verify with your phone number

### Step 2: Generate App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **2-Step Verification**
3. Scroll down to **App passwords** section
4. Click **App passwords** (you may need to re-enter your password)
5. In the "Select app" dropdown, choose **Mail**
6. In the "Select device" dropdown, choose **Other (Custom name)**
7. Enter "FitVibe Backend" as the custom name
8. Click **Generate**
9. **IMPORTANT**: Copy the 16-character password immediately (you won't be able to see it again)
   - Example: `abcd efgh ijkl mnop` (remove spaces when using)

### Step 3: Save App Password Securely

```bash
# Example app password (yours will be different):
abcdefghijklmnop
```

⚠️ **Security Note**: Never commit this password to Git. Store it in your `.env` file only.

---

## Environment Configuration

### Update `.env` File

Add these lines to your `.env` file in the project root:

```bash
# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
SMTP_FROM_NAME=FitVibe
SMTP_FROM_EMAIL=your-email@gmail.com

# Enable email features
EMAIL_ENABLED=true
```

### Configuration Details

| Variable          | Value              | Description                           |
| ----------------- | ------------------ | ------------------------------------- |
| `SMTP_HOST`       | `smtp.gmail.com`   | Gmail SMTP server address             |
| `SMTP_PORT`       | `587`              | TLS port (recommended)                |
| `SMTP_SECURE`     | `false`            | Use STARTTLS (not SSL)                |
| `SMTP_USER`       | Your Gmail address | Full email address                    |
| `SMTP_PASS`       | Your app password  | 16-character app password (no spaces) |
| `SMTP_FROM_NAME`  | `FitVibe`          | Sender name shown in emails           |
| `SMTP_FROM_EMAIL` | Your Gmail address | Reply-to email address                |
| `EMAIL_ENABLED`   | `true`             | Enable/disable email sending          |

### Example Configuration

```bash
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=fitvibe.noreply@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM_NAME=FitVibe Training
SMTP_FROM_EMAIL=fitvibe.noreply@gmail.com
EMAIL_ENABLED=true
```

---

## Testing Email Functionality

### 1. Restart Backend Server

After updating `.env`, restart the backend:

```bash
# Stop the server (Ctrl+C)
# Start again
pnpm --filter @fitvibe/backend dev
```

### 2. Test Registration Email

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "username": "testuser",
    "profile": {
      "display_name": "Test User"
    }
  }'
```

**Expected Result**:

- ✅ User created successfully
- ✅ Verification email sent to test@example.com
- Check email inbox for verification link

### 3. Test Password Reset Email

```bash
curl -X POST http://localhost:4000/api/v1/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Result**:

- ✅ Returns success message
- ✅ Password reset email sent
- Check email inbox for reset link

### 4. Check Backend Logs

Look for log messages indicating email sending:

```
[INFO] Sending email to: test@example.com
[INFO] Email sent successfully
```

Or errors:

```
[ERROR] Failed to send email: Invalid credentials
```

---

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Cause**: App password is incorrect or 2FA is not enabled

**Solution**:

1. Verify 2FA is enabled on your Gmail account
2. Generate a new app password
3. Copy the entire 16-character password (remove spaces)
4. Update `SMTP_PASS` in `.env`
5. Restart backend server

### Error: "ECONNREFUSED" or "Connection timeout"

**Cause**: SMTP port is blocked by firewall or incorrect host/port

**Solution**:

1. Verify `SMTP_HOST=smtp.gmail.com`
2. Try alternate port: `SMTP_PORT=465` with `SMTP_SECURE=true`
3. Check firewall settings allow outbound connections to port 587/465
4. If on corporate network, check if SMTP is blocked

### Error: "self signed certificate in certificate chain"

**Cause**: TLS/SSL certificate validation issue

**Solution**:
Add to `.env`:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0  # Only for development!
```

⚠️ **Security Warning**: Never use in production!

### Emails Going to Spam

**Cause**: Gmail's spam filters or missing SPF/DKIM records

**Solution**:

1. **Short-term**: Check spam folder, mark as "Not Spam"
2. **Long-term**: Use a dedicated email service (SendGrid or Mailgun)
3. Add SPF record to your domain (if using custom domain)
4. Set up DKIM signing

### Rate Limiting

**Gmail Limits**:

- 500 emails per day (personal Gmail)
- 2000 emails per day (Google Workspace)
- 100 recipients per email

**Solution**:

- For production, use transactional email service
- Implement email queuing for bulk operations

---

## Alternative Email Providers

### SendGrid (Recommended for Production)

**Why**: High deliverability, detailed analytics, generous free tier

**Setup**:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=FitVibe
```

**Free Tier**: 100 emails/day forever

**Steps**:

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Verify your sender identity
3. Create API key
4. Use `apikey` as username and API key as password

### Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
```

**Free Tier**: 5,000 emails/month for 3 months

### Mailtrap (Development/Testing Only)

**Why**: Catches all emails in a virtual inbox (nothing actually sent)

```bash
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

**Perfect for**:

- Development
- Testing email templates
- CI/CD pipelines

---

## Email Templates

FitVibe sends these types of emails:

### 1. Email Verification (Registration)

**Subject**: "Verify your FitVibe account"

**Content**:

- Welcome message
- Verification link (expires in 15 minutes)
- Instructions

### 2. Password Reset

**Subject**: "Reset your FitVibe password"

**Content**:

- Reset link (expires in 15 minutes)
- Security notice
- Contact support link

### 3. Password Changed Notification

**Subject**: "Your FitVibe password was changed"

**Content**:

- Confirmation of password change
- Timestamp
- Security alert if not initiated by user

### 4. Account Deletion Scheduled (GDPR)

**Subject**: "Your FitVibe account will be deleted"

**Content**:

- Notification of upcoming deletion
- Date of deletion
- How to cancel deletion

---

## Production Recommendations

### 1. Use Dedicated Email Service

Don't use Gmail for production:

- ❌ Limited sending quota
- ❌ Can be marked as spam
- ❌ No detailed analytics
- ❌ No email queueing

Use instead:

- ✅ SendGrid
- ✅ Mailgun
- ✅ Postmark

### 2. Set Up Email Queue

Implement background job processing:

```typescript
// Use Bull or BullMQ for email queue
await emailQueue.add("send-email", {
  to: user.email,
  template: "verification",
  data: { token },
});
```

### 3. Monitor Email Delivery

Track:

- Delivery rate
- Bounce rate
- Spam complaints
- Open rate (optional)

### 4. Implement Email Retries

```typescript
const sendWithRetry = async (message, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mailer.send(message);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
};
```

### 5. Validate Email Addresses

Use email validation library:

```bash
pnpm add email-validator
```

```typescript
import * as EmailValidator from "email-validator";

if (!EmailValidator.validate(email)) {
  throw new Error("Invalid email address");
}
```

---

## Quick Start Checklist

- [ ] Enable 2FA on Gmail account
- [ ] Generate Gmail App Password
- [ ] Add SMTP configuration to `.env`
- [ ] Restart backend server
- [ ] Test registration email
- [ ] Test password reset email
- [ ] Check email inbox
- [ ] Verify links work correctly
- [ ] Monitor backend logs for errors

---

## Support

If you encounter issues:

1. **Check logs**: Look for detailed error messages in backend console
2. **Verify credentials**: Double-check app password is correct
3. **Test connection**: Use online SMTP testing tools
4. **Check quota**: Ensure you haven't exceeded Gmail's daily limit
5. **Review firewall**: Make sure SMTP ports aren't blocked

---

## Related Documentation

- [User Flow Documentation](./User_Flow_Documentation.md)
- [Environment Configuration](./.env.example)
- [Backend Services](./2b.Technical_Design_Document_Modules.md)
- [Security Policy](./SECURITY.md)
