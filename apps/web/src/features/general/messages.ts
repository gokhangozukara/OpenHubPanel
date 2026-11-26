export const errors: Record<string, string> = {
  NETWORK_ERROR: "Connection lost. Check your network and retry.",
  TIMEOUT: "The request timed out. Reload to check the latest data.",
  UNAVAILABLE: "The service is unavailable. Please try again.",
  INVALID_INPUT: "The details are invalid. Check the highlighted fields and try again.",
  NOT_FOUND: "This item is unavailable. Reload the workspace.",
  CONNECTION_TARGET_BLOCKED: "This API address is blocked by the connection safety policy.",
  CONNECTION_PERMISSION_DENIED: "The connected application rejected this API key.",
  INVALID_CONNECTION_URL: "Enter a valid public HTTPS API address.",
  TARGET_APPROVAL_REQUIRED: "Approve the API address and enter a valid API key.",
  ALREADY_MEMBER: "This account already belongs to this workspace.",
  TRANSFER_REQUIRED: "Use an ownership offer to appoint a new owner.",
  UNAUTHENTICATED: "Your session ended. Please sign in again.",
  FORBIDDEN: "You do not have permission for this action.",
  INVALID_CREDENTIALS: "Sign-in details could not be verified.",
  INVALID_CODE: "The authenticator code is invalid or already used. Wait for a new code.",
  INVALID_BOOTSTRAP: "The setup token is invalid, expired or already used.",
  INVALID_INVITATION: "This invitation is invalid, expired or already used.",
  SIGN_IN_REQUIRED: "This account exists. Sign in to accept the invitation.",
  LAST_OWNER: "The last owner must remain active. Transfer ownership first.",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  CONFLICT: "The data changed. Reload and review before trying again.",
  UNKNOWN_OUTCOME: "The result is uncertain. Retry the same request to check its result.",
  PASSWORD_LENGTH: "Use a password between 6 and 256 characters.",
  COMMON_PASSWORD: "This password is too common. Choose another password.",
  PASSWORD_COMPROMISED: "This password has appeared in a data breach. Choose another password.",
  PASSWORD_CHECK_UNAVAILABLE: "The password safety check is unavailable. Please try again later.",
  REMOTE_READ_ONLY: "This connection only allows reading.",
  CONNECTION_NOT_FOUND: "This connection is unavailable or disabled.",
  CONNECTION_UNAVAILABLE: "The connected application could not be reached.",
  INCOMPATIBLE_CONNECTION: "The application does not support the required API contract.",
  INVALID_TRANSFER: "This ownership offer is unavailable or expired.",
};

export function errorMessage(code: string) {
  return (
    (Object.hasOwn(errors, code) ? errors[code] : undefined) ??
    "The request could not be completed. Review the details and try again."
  );
}
