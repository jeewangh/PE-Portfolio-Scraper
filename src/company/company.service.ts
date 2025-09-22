import { Injectable, Logger } from '@nestjs/common';
import { CompanyInterface, NewCompany } from '../types/scrapper/kkr/company-data-model.i';
import { CompanyHelper } from './company.helper';
import { CompanyRepository } from './company.repository';
import { CompanyDocument } from './schema/company.schema';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);
  private companiesCache: CompanyInterface[] = [];

  constructor(private readonly companyRepo: CompanyRepository) {}

  async getCompanies(forceRefresh = false): Promise<CompanyInterface[]> {
    if (this.companiesCache.length === 0 || forceRefresh) {
      this.logger.log('Loading companies from database...');
      this.companiesCache = await this.companyRepo.findAll();
      this.logger.log(`Loaded ${this.companiesCache.length} companies`);
    }
    return this.companiesCache;
  }

  async getSummary(): Promise<{ totalCompanies: number; lastFetch: string | undefined }> {
    this.logger.log('Generating summary...');
    const companies = await this.getCompanies();
    if (companies.length === 0) {
      this.logger.log('No companies found');
      return { totalCompanies: 0, lastFetch: undefined };
    }

    const lastFetch = companies
      .map((c) => c.companyId?.toString())
      .filter(Boolean)
      .sort()
      .pop();

    return { totalCompanies: companies.length, lastFetch };
  }

  async saveOrUpdate(companyData: NewCompany): Promise<void> {
    let existing: CompanyDocument | null = null;

    if (companyData.general?.websiteUrl) {
      existing = await this.companyRepo.findByWebsite(companyData.general.websiteUrl);
    } else if (companyData.general?.name) {
      existing = await this.companyRepo.findByName(companyData.general.name);
    }

    if (existing) {
      const merged = CompanyHelper.mergeCompanyData(existing, companyData);
      await this.companyRepo.updateByCompanyId(existing.companyId, merged);
    } else {
      await this.companyRepo.createCompany(companyData);
    }
  }

  async saveAll(companies: NewCompany[], batchSize = 10): Promise<void> {
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (company) => {
          try {
            await this.saveOrUpdate(company);
          } catch (err) {
            this.logger.warn(
              `Failed to save company ${company.general?.name ?? 'Unknown'}: ${String(err)}`,
            );
          }
        }),
      );
    }
  }

  clearCache(): void {
    this.companiesCache = [];
    this.logger.log('Company cache cleared');
  }

  async refreshCompanies(): Promise<void> {
    this.clearCache();
    await this.getCompanies(true);
  }
}
