import { useSuspenseQuery } from "@tanstack/react-query";
import { featuresKeyFactory } from "./key-factory";
import { getFeatures } from "../../../jira/features";
import { useStorage } from "../storage";

export const useFeatures = () => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: featuresKeyFactory.features,
    queryFn: () => getFeatures(storage),
  });

  return data;
};
