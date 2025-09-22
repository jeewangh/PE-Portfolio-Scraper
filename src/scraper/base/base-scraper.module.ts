import { Module } from '@nestjs/common';
import { BrowserService } from './services/browser.service';
import { DataExtractionService } from './services/data-extraction.service';

@Module({
  providers: [BrowserService, DataExtractionService],
  exports: [BrowserService, DataExtractionService],
})
export class BaseScraperModule {}
