# Security

Do not report credentials, production member records or private financial data in public issues. Report suspected vulnerabilities privately using GitHub private vulnerability reporting when available, or contact the repository owner privately.

Production secrets belong in server-side environment configuration. Supabase service-role and PayOS secrets must never be sent to the browser. Example configuration and test fixtures must use dummy data.

If a credential is exposed, revoke or rotate it before removing copies. Deleting a file does not remove earlier Git commits.
