import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    magicLinkClient(),
    usernameClient()
  ]
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  organization,
  useListOrganizations,
  useActiveOrganization
} = authClient;
