export type NewCompany = Omit<CompanyInterface, 'companyId' | 'createdAt' | 'updatedAt'>;

export interface CompanyInterface {
  companyId: number;
  general: General;
  location?: Location;
  industry?: Industry;
  ownership?: Ownership;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface General {
  name: string; //Using name as a unique identifier
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  relevantLinks?: string[];
  employeeCount?: string;
  executiveMembers?: string[];
}

export interface Location {
  hq?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Industry {
  industryType?: string;
}

export interface Ownership {
  operatingRegion?: string[];
  yearSinceInvestment?: string;
  assetClasses?: string[];
  investmentInterest?: string;
}
