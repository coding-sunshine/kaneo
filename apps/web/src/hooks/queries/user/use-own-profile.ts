import { useQuery } from "@tanstack/react-query";
import getOwnProfile from "@/fetchers/user/get-own-profile";

export const OWN_PROFILE_QUERY_KEY = ["user", "profile"] as const;

function useOwnProfile() {
  return useQuery({
    queryKey: OWN_PROFILE_QUERY_KEY,
    queryFn: getOwnProfile,
  });
}

export default useOwnProfile;
