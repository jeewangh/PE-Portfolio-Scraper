import { Controller, Get } from '@nestjs/common';
import { KkrScraperService } from './kkr-scraper.service';
import { CompanyInterface } from '../../types/scrapper/kkr/company-data-model.i';

@Controller('kkr-scraper')
export class KkrScraperController {
  constructor(private readonly scraperService: KkrScraperService) {}

  @Get('portfolio')
  async scrapePortfolio(): Promise<CompanyInterface[]> {
    return await this.scraperService.scrapeAllPortfolio();
  }

  @Get('companies')
  async getAllCompanies(): Promise<CompanyInterface[]> {
    return await this.scraperService.fetchAllCompanies();
  }
}
