import type { UserValidateEvent } from "@netlify/functions";

// The site has a single owner. New accounts can only come from an invite sent from the Netlify dashboard;
// public self-signups are refused so nobody else can create an account.
export default {
  userValidate(event: UserValidateEvent) {
    if (!event.user.invitedAt) return event.deny();
  },
};
