import { apiRequest } from "@/lib/api/http";
import type { Region } from "@/types/api";

export function getRegions(): Promise<Region[]> {
  return apiRequest<Region[]>("/api/regions");
}
