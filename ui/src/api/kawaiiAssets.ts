import type { KawaiiAssetOwnerType, KawaiiAssetPurpose, KawaiiAssetSet } from "@paperclipai/shared";
import { api } from "./client";

export type KawaiiSetupResponse = {
  setup: KawaiiAssetSet;
  scenes: KawaiiAssetSet[];
};

export type KawaiiAssetListOptions = {
  ownerType?: KawaiiAssetOwnerType;
  ownerId?: string;
  purpose?: KawaiiAssetPurpose;
};

function query(options: KawaiiAssetListOptions = {}) {
  const params = new URLSearchParams();
  if (options.ownerType) params.set("ownerType", options.ownerType);
  if (options.ownerId) params.set("ownerId", options.ownerId);
  if (options.purpose) params.set("purpose", options.purpose);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const kawaiiAssetsApi = {
  list: (companyId: string, options?: KawaiiAssetListOptions) =>
    api.get<KawaiiAssetSet[]>(`/companies/${companyId}/kawaii/assets${query(options)}`),

  regenerate: (
    companyId: string,
    input: {
      ownerType: KawaiiAssetOwnerType;
      ownerId: string;
      purpose: KawaiiAssetPurpose;
    },
  ) => api.post<KawaiiAssetSet>(`/companies/${companyId}/kawaii/assets/regenerate`, input),

  regenerateAgent: (agentId: string) =>
    api.post<KawaiiAssetSet>(`/agents/${agentId}/kawaii-assets/regenerate`, {}),

  setupCompany: (companyId: string) =>
    api.post<KawaiiSetupResponse>(`/companies/${companyId}/kawaii/setup`, {}),
};
