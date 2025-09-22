import { Page } from 'puppeteer';
import { DataExtractionService } from '../../../scraper/base/services/data-extraction.service';
import { BrowserService } from '../../../scraper/base/services/browser.service';

export interface ScraperConfig {
  name: string;
  baseUrl: string;
  userAgent?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimit?: {
    maxConcurrent?: number;
    minTime?: number;
  };
}

export interface PageContext {
  page: Page;
  browserService: BrowserService;
  dataExtractionService: DataExtractionService;
}
