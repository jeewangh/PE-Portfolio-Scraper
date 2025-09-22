import { Injectable, Logger } from '@nestjs/common';
import { BaseDataModel } from '../../types/scrapper/base/base-data-model.i';
import { BrowserService } from './services/browser.service';
import { PageContext, ScraperConfig } from '../../types/scrapper/base/scraper.types.i';
import { DataExtractionService, ExtractionRule } from './services/data-extraction.service';
import { GoToOptions, Page } from 'puppeteer';
import { getRandomUserAgent } from '../../utils/user-agents';
import { sleep, withRetry } from '../../utils/time.utils';

@Injectable()
export abstract class BaseScraperStrategy<T extends BaseDataModel> {
  protected readonly logger = new Logger(this.constructor.name);

  private readonly defaultGoToOptions: GoToOptions = {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  };

  constructor(
    protected readonly config: ScraperConfig,
    protected readonly browserService: BrowserService,
    protected readonly dataExtractionService: DataExtractionService,
  ) {}

  abstract getPortfolioExtractionRules(): ExtractionRule[];

  abstract getTableSelectors(): { table: string; row: string; popUp?: string };

  abstract isNextPageAvailable(contex: PageContext): Promise<boolean>;

  abstract scrapePortfolioList(context: PageContext): Promise<T[]>;

  async initializePage(options?: {
    emulateDevice?: string;
    timeout?: number;
  }): Promise<PageContext> {
    const page = await this.browserService.createPage({
      userAgent: getRandomUserAgent(),
      timeout: options?.timeout || 30000,
    });

    this.setupRequestInterception(page);

    const context: PageContext = {
      page,
      browserService: this.browserService,
      dataExtractionService: this.dataExtractionService,
    };

    this.logger.debug(`Initialized page for ${this.config.name}`);
    return context;
  }

  private setupRequestInterception(page: Page): void {
    page.on('response', (response) => {
      if (!response.ok() && response.status() >= 400) {
        this.logger.debug(`Response status ${response.status()} for ${response.url()}`);
      }
    });

    page.on('pageerror', (error) => {
      this.logger.warn(`Page error: ${error.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.logger.debug(`Console error: ${msg.text()}`);
      }
    });
  }

  // Common: Navigate with retry and wait for idle
  protected async navigateToPortfolio(context: PageContext, url: string): Promise<void> {
    await withRetry(() =>
      this.navigate(context.page, url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      }),
    );
  }

  // Common: Extract table using DataExtractionService
  protected async extractPortfolioTable(context: PageContext) {
    const selectors = this.getTableSelectors();
    return await this.dataExtractionService.extractTable(context.page, selectors.table, {
      rowSelector: selectors.row,
    });
  }

  // Common: Infinite scroll via NavigationService
  protected async loadAllContent(context: PageContext): Promise<void> {
    await this.infiniteScroll(context.page, {
      maxScrolls: 20,
      scrollDelay: 2000,
      contentSelector: this.getTableSelectors().row,
    });
  }

  protected normalizeUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.config.baseUrl}${url}`;
    return `https://${url}`;
  }

  async infiniteScroll(
    page: Page,
    options?: {
      maxScrolls?: number;
      scrollDelay?: number;
      contentSelector?: string;
    },
  ): Promise<void> {
    const { maxScrolls = 10, scrollDelay = 1000, contentSelector } = options || {};

    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        break;
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(scrollDelay);

      if (contentSelector) {
        try {
          await page.waitForSelector(contentSelector, { timeout: 5000 });
        } catch {
          // Continue scrolling even if selector not found
        }
      }

      previousHeight = currentHeight;
      scrollCount++;
    }
  }

  async navigate(page: Page, url: string, options?: GoToOptions): Promise<void> {
    const finalOptions = { ...this.defaultGoToOptions, ...options };
    this.logger.debug(`Navigating to: ${url}`);

    try {
      await page.goto(url, finalOptions);
      this.logger.debug(`Successfully navigated to: ${url}`);
    } catch (error) {
      this.logger.error(`Failed to navigate to ${url}`, error);
      throw error;
    }
  }
}
