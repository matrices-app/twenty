import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { AppPath } from '@/types/AppPath';
import { useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useSignUpMutation } from '~/generated/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';

let signingUp = false;

export const useAutoSignUp = (isOnBaseDomain: boolean) => {
  const [signUp] = useSignUpMutation();
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();

  useEffect(() => {
    (async () => {
      if (!isOnBaseDomain || signingUp) {
        return;
      }
      signingUp = true;

      const email = `${uuid()}@matrices.app`;

      const signUpResult = await signUp({
        variables: {
          email,
          password: `password`,
        },
      });

      if (!signUpResult.data?.signUp) {
        throw new Error('No login token');
      }

      return redirectToWorkspaceDomain(
        getWorkspaceUrl(signUpResult.data.signUp.workspace.workspaceUrls),
        AppPath.Verify,
        {
          loginToken: signUpResult.data.signUp.loginToken.token,
          email,
        },
      );
    })();
  }, [isOnBaseDomain, signUp, redirectToWorkspaceDomain]);
};
