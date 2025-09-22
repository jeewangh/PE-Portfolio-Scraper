import { BaseDataModel } from '../base/base-data-model.i';

export interface ScrappedCompany extends BaseDataModel {
  name: string;
  logo?: string;
  yoi?: string;
  hq?: string;
  description?: string;
  industry?: string;
  assetClass?: string;
  region?: string;
  url?: string;
  relatedLinkOne?: string;
  relatedLinkTwo?: string;
  relatedLinks?: string[];
  employeeCount?: string;
  executiveMembers?: string[];
  ownershipDetails?: string;
  source?: string;
}

export interface ScrapperApiResponse {
  success: boolean;
  message: string;
  hits: number;
  resultsText: string;
  pages: number;
  startNumber: number;
  endNumber: number;
  results: ScrappedCompany[];
}
