import { Injectable, Logger } from '@nestjs/common';
import { DatabaseRepository } from '../database/database.repository';
import { CompanyDocument, Company } from './schema/company.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompanyInterface } from '../types/scrapper/kkr/company-data-model.i';

@Injectable()
export class CompanyRepository extends DatabaseRepository<CompanyDocument> {
  private readonly logger = new Logger(CompanyRepository.name);

  constructor(
    @InjectModel(Company.name)
    companyModel: Model<CompanyDocument>,
  ) {
    super(companyModel);
  }

  /** Find by website */
  async findByWebsite(websiteUrl: string): Promise<CompanyDocument | null> {
    return this.findOne({ 'general.websiteUrl': websiteUrl });
  }

  /** Find by name */
  async findByName(name: string): Promise<CompanyDocument | null> {
    return this.findOne({ 'general.name': name });
  }

  /** Find by auto-increment ID */
  async findByCompanyId(id: number): Promise<CompanyDocument | null> {
    return this.findOne({ companyId: id });
  }

  /** Create a new company */
  async createCompany(company: Partial<Company>): Promise<CompanyDocument> {
    return this.save(company);
  }

  /** Update a company by ID */
  async updateExisting(existing: CompanyDocument, company: CompanyInterface): Promise<void> {
    existing.set(company);
    await existing.save();
  }

  /** Delete a company by ID */
  async deleteByCompanyId(id: number): Promise<CompanyDocument | null> {
    return this.delete({ companyId: id });
  }

  /** Get last updated timestamp */
  async getLastUpdated(): Promise<string | undefined> {
    const latest = await this.model
      .findOne({}, { updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    return latest?.updatedAt?.toISOString();
  }
}
