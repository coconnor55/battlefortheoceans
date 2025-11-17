# Supabase Email Templates

This directory contains custom email templates for Supabase authentication emails.

## Files

- `confirm-signup.html` - HTML template for email confirmation
- `confirm-signup.txt` - Plain text version for email clients that don't support HTML

## How to Use in Supabase

1. **Log in to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to Email Templates**
   - Go to **Authentication** → **Email Templates**
   - Or go to **Settings** → **Auth** → **Email Templates**

3. **Edit the Confirmation Email Template**
   - Find the "Confirm signup" template
   - Click **Edit** or the template name

4. **Copy the HTML Template**
   - Open `confirm-signup.html` in this directory
   - Copy the entire contents
   - Paste into the **HTML** field in Supabase

5. **Copy the Plain Text Template (Optional but Recommended)**
   - Open `confirm-signup.txt` in this directory
   - Copy the entire contents
   - Paste into the **Plain text** field in Supabase

6. **Save the Template**
   - Click **Save** or **Update**

## Template Variables

Supabase provides these variables in email templates:

- `{{ .ConfirmationURL }}` - The confirmation link the user needs to click
- `{{ .SiteURL }}` - Your site's base URL
- `{{ .Email }}` - The user's email address
- `{{ .Token }}` - The confirmation token (usually not needed)
- `{{ .TokenHash }}` - Hashed token (usually not needed)
- `{{ .RedirectTo }}` - Redirect URL after confirmation

## Customization

The template uses:
- Dark background (`#0a0e27`) matching the game's aesthetic
- Light blue text (`#00d9ff`) for the game's brand color
- Anchor icon (⚓) matching the invitation emails
- Responsive design for mobile email clients

You can customize colors, fonts, and content as needed while maintaining the branded look.

## Testing

After updating the template in Supabase:
1. Try signing up with a test email
2. Check that the email matches the invitation email style
3. Verify the confirmation link works correctly
4. Test on different email clients (Gmail, Outlook, Apple Mail, etc.)

## Notes

- Email clients have varying support for CSS. The template uses inline-compatible styles where possible.
- Some email clients strip out certain CSS properties. The template is designed to degrade gracefully.
- Always test the confirmation link to ensure it works correctly.

