import { Injectable, Logger } from '@nestjs/common';
import { KkrScraperStrategy } from './kkr-scraper.strategy';
import { ScrappedCompany } from '../../types/scrapper/kkr/scrapper-api.response';
import { CompanyInterface, NewCompany } from '../../types/scrapper/kkr/company-data-model.i';
import { LocationService } from '../../location/location.service';
import { CompanyService } from '../../company/company.service';
import { ScraperConfig } from '../../types/scrapper/base/scraper.types.i';
import { DataExtractionService } from '../base/services/data-extraction.service';
import { BrowserService } from '../base/services/browser.service';

@Injectable()
export class KkrScraperService {
  private readonly logger: Logger = new Logger(KkrScraperService.name);
  private readonly scraper: KkrScraperStrategy;
  readonly batchSize: number = 10; //Batch Process response 10 at time
  readonly baseUrl: string;

  constructor(
    browserService: BrowserService,
    dataExtractionService: DataExtractionService,
    private readonly locationService: LocationService,
    private readonly companyService: CompanyService,
  ) {
    const scraperConfig: ScraperConfig = {
      name: 'KKR',
      baseUrl: 'https://www.kkr.com',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 2000,
    };
    this.baseUrl = scraperConfig.baseUrl;
    this.scraper = new KkrScraperStrategy(scraperConfig, browserService, dataExtractionService);
  }

  async scrapeAllPortfolio(): Promise<CompanyInterface[]> {
    try {
      const companies = await this.scraper.scrapePage();
      await this.batchProcessCompanies(companies);
    } catch (error) {
      this.logger.error('Error scraping portfolio', error);
      throw error;
    }

    return this.companyService.getCompanies();
  }

  async fetchAllCompanies(): Promise<CompanyInterface[]> {
    return await this.companyService.getCompanies(true);
  }

  private async batchProcessCompanies(companies: ScrappedCompany[]): Promise<void> {
    const batchSize = this.batchSize;

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      const processedCompanies: NewCompany[] = [];
      for (const company of batch) {
        try {
          const transformedCompany = await this.transformCompany(company);
          processedCompanies.push(transformedCompany);
        } catch (error) {
          this.logger.error(
            `Failed to transform company: ${error instanceof Error ? error.stack : String(error)}`,
          );
        }
      }
      await this.companyService.saveAll(processedCompanies);
    }
  }

  /** Transform to Company  format */
  public async transformCompany(sc: ScrappedCompany): Promise<NewCompany> {
    const baseUrl = this.baseUrl;

    const websiteUrl = sc.url?.trim().replace(/\/+$/, '');

    let logoUrl = sc.logo?.trim().replace(/^\/+/, '') ?? '';
    if (logoUrl && !logoUrl.startsWith('http')) logoUrl = `${baseUrl}/${logoUrl}`;

    const relevantLinks = (() => {
      const links = new Set(
        [sc.relatedLinkOne, sc.relatedLinkTwo, ...(sc.relatedLinks ?? [])]
          .filter((link): link is string => Boolean(link))
          .map((link) => {
            let trimmed = link.trim().replace(/\/+$/, '');
            if (!trimmed.startsWith('http')) {
              trimmed = `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;
            }
            return trimmed;
          }),
      );

      return links.size > 0 ? Array.from(links) : undefined;
    })();

    const regions = sc.region
      ? sc.region
          .split(/,| And /i)
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;

    const assetClasses = sc.assetClass
      ?.split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    return {
      general: {
        name: sc.name,
        description: sc.description?.replace(/<[^>]*>/g, '').trim(),
        websiteUrl,
        logoUrl,
        relevantLinks: relevantLinks,
        employeeCount: sc.employeeCount,
        executiveMembers: sc.executiveMembers,
      },
      location: {
        hq: sc.hq,
        ...(sc.hq ? await this.locationService.parseHQ(sc.hq) : {}),
      },
      industry: { industryType: sc.industry },
      ownership: {
        operatingRegion: regions,
        yearSinceInvestment: sc.yoi,
        assetClasses,
        investmentInterest: sc.ownershipDetails,
      },
    };
  }
}
