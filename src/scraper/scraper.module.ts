import { Module } from '@nestjs/common';
import { KkrScraperModule } from './kkr-scraper/kkr-scraper.module';

@Module({
  imports: [KkrScraperModule],
})
export class ScraperModule {}
