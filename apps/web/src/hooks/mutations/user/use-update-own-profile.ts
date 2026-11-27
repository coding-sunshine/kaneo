import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateOwnProfile from "@/fetchers/user/update-own-profile";
import { OWN_PROFILE_QUERY_KEY } from "@/hooks/queries/user/use-own-profile";

function useUpdateOwnProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(OWN_PROFILE_QUERY_KEY, profile);
      // Member lists carry everyone's profile: pickers, chat and People.
      return queryClient.invalidateQueries({ queryKey: ["workspace-users"] });
    },
  });
}

export default useUpdateOwnProfile;
