# Google Workspace SMTP implementation notes

Research date: 25 August 2026.

Google Workspace’s official guidance says SMTP relay is the recommended and most secure option for apps and devices, using `smtp-relay.gmail.com` on port 25, 465, or 587 with SSL/TLS. The Gmail SMTP server option uses `smtp.gmail.com`; port 465 is SSL and port 587 is TLS. The guidance says authentication should use the complete Workspace email address and an app password when using this option. Source: https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app

Google’s app-password guidance says an app password is a 16-digit passcode and requires 2-Step Verification on the account. Source: https://support.google.com/mail/answer/185833?hl=en

Google Workspace no longer supports less-secure apps that ask for username/password directly; Google recommends OAuth 2.0. The Workspace guidance lists app passwords as an alternative for some office devices/apps that cannot migrate, while the project implementation should keep the app password server-side and use a dedicated mailbox with minimal scope. Source: https://knowledge.workspace.google.com/admin/apps/control-access-to-less-secure-apps
