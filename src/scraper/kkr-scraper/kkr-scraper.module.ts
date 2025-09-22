import { Module } from '@nestjs/common';
import { BaseScraperModule } from '../base/base-scraper.module';
import { KkrScraperService } from './kkr-scraper.service';
import { KkrScraperController } from './kkr-scraper.controller';
import { LocationModule } from '../../location/location.module';
import { CompanyModule } from '../../company/company.module';

@Module({
  imports: [BaseScraperModule, LocationModule, CompanyModule],
  providers: [KkrScraperService],
  controllers: [KkrScraperController],
})
export class KkrScraperModule {}
