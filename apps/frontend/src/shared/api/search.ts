import api from "./client";
import { isMockMode, mockSearchService } from "@/mock";

export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  route: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  items: SearchItem[];
};

export type SearchResponse = {
  groups: SearchGroup[];
};

export const searchService = {
  async search(q: string, schoolId?: string) {
    if (isMockMode() && schoolId) {
      const groups = await mockSearchService.search(schoolId, q);
      return { groups };
    }
    const response = await api.get<SearchResponse>("/search", { params: { q } });
    return response.data;
  },
};

