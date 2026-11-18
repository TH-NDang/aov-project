import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createArcanaStatColors } from "@aov/ui/lib/arcana-stat-colors"
import { defaultSettings, loadSettings, referenceSettingsKeys } from "../../../terminology/settings-api"
export function useArcanaStatColors() {
  const settings = useQuery({
    queryKey: referenceSettingsKeys.all,
    queryFn: loadSettings,
    retry: false,
    staleTime: 60000,
  })
  const entities = settings.data?.settings.entities ?? defaultSettings.entities
  return useMemo(() => createArcanaStatColors(entities), [entities])
}
