import { Injectable, Logger } from '@nestjs/common';
import { PageContext, ScraperConfig } from '../../types/scrapper/base/scraper.types.i';
import { BaseScraperStrategy } from '../base/base-scraper.strategy';
import {
  ScrappedCompany,
  ScrapperApiResponse,
} from '../../types/scrapper/kkr/scrapper-api.response';
import { DataExtractionService, ExtractionRule } from '../base/services/data-extraction.service';
import { BrowserService } from '../base/services/browser.service';
import { sleep, withRetry } from '../../utils/time.utils';
import { CompanyHelper } from '../../company/company.helper';
import { Page } from 'puppeteer';

@Injectable()
export class KkrScraperStrategy extends BaseScraperStrategy<ScrappedCompany> {
  protected readonly logger = new Logger(KkrScraperStrategy.name);
  private interceptedCompaniesMap: Map<string, ScrappedCompany> = new Map();
  protected config: ScraperConfig;

  constructor(
    config: ScraperConfig,
    browserService: BrowserService,
    dataExtractionService: DataExtractionService,
  ) {
    super(config, browserService, dataExtractionService);
    this.config = config;
  }

  /**
   * Defines extraction rules for portfolio data from modals
   */
  getPortfolioExtractionRules(): ExtractionRule[] {
    return [
      {
        field: 'name',
        selector: '#portfolio-flyout .cmp-portfolio-filter__portfolio-title',
        required: true,
        transform: (value: string) => value.trim(),
      },
      {
        field: 'logo',
        selector: '#portfolio-flyout .cmp-portfolio-filter__portfolio-header img',
        required: false,
        attribute: 'src',
      },
      {
        field: 'description',
        selector: '#portfolio-flyout .cmp-portfolio-filter__portfolio-description p',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'url',
        selector: '#portfolio-flyout .website-details .site-link',
        attribute: 'href',
        transform: (value: string) => this.normalizeUrl(value),
      },
      {
        field: 'hq',
        selector: '#portfolio-flyout .hq-details .sub-desc',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'assetClass',
        selector: '#portfolio-flyout .asset-details .sub-desc',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'industry',
        selector: '#portfolio-flyout .industry-details .sub-desc',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'region',
        selector: '#portfolio-flyout .region-details .sub-desc',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'yoi',
        selector: '#portfolio-flyout .year-details .sub-desc',
        transform: (value: string) => value.trim(),
      },
      {
        field: 'relatedLinks',
        selector:
          '#portfolio-flyout .cmp-portfolio-filter__additional-details--values a.site-link[href]:not([href*="undefined"])',
        attribute: 'href',
        multiple: true,
        required: false,
        transform: (href: string) => href?.trim(),
      },
    ];
  }

  /**
   * Defines table and modal selectors
   */
  getTableSelectors() {
    return {
      table: '.cmp-portfolio-filter__result--table-portfolio',
      row: '.cmp-portfolio-filter__result--table-body tr.toggle-table-row-click',
      popUp: '.modal-content-row',
      closeButton: '.cmp-portfolio-filter__close-btn',
    };
  }

  async isNextPageAvailable(context: PageContext): Promise<boolean> {
    const page = context.page;

    const currentPageEl = await page.$('.cmp-portfolio-filter__page.active');

    if (!currentPageEl) return false;

    const currentPage = await currentPageEl.evaluate((el) => Number(el.getAttribute('data-page')));
    if (!currentPage) return false;

    const nextPageSelector = `.cmp-portfolio-filter__page[data-page="${currentPage + 1}"]`;
    const nextPageEl = await page.$(nextPageSelector);

    return nextPageEl !== null;
  }

  async goToNextPage(context: PageContext): Promise<boolean> {
    const previousSnapshot = await this.getTableSnapshot(context);

    const page = context.page;

    const nextPageExists = await this.isNextPageAvailable(context);
    if (!nextPageExists) return false;

    const currentPageEl = await page.$('.cmp-portfolio-filter__page.active');

    if (!currentPageEl) return false;

    const currentPage = await currentPageEl.evaluate((el) => Number(el.getAttribute('data-page')));
    const nextPageSelector = `.cmp-portfolio-filter__page[data-page="${currentPage + 1}"]`;

    const clicked = await context.dataExtractionService.click(page, nextPageSelector);
    if (!clicked) return false;

    await this.waitForTableChange(context, previousSnapshot);

    return true;
  }

  async scrapePage(): Promise<ScrappedCompany[]> {
    const context = await this.initializePage();

    const results = await this.scrapePortfolioList(context);
    const interceptedCompanies = this.getAllInterceptedData();

    const aggregatedResults = this.deduplicateCompanies([...results, ...interceptedCompanies]);

    await this.enrichCompaniesFromRelatedLinks(context.page, aggregatedResults);
    await context.browserService.cleanup(context.page);

    return aggregatedResults;
  }

  /**
   * Main method to scrape the entire portfolio list
   */
  async scrapePortfolioList(context: PageContext): Promise<ScrappedCompany[]> {
    try {
      await this.navigateToPortfolio(context, `${this.config.baseUrl}/invest/portfolio`);
      this.attachNetworkInterceptor(context);

      const assetClasses = await this.getAssetClasses(context);
      const results: ScrappedCompany[] = [];

      if (assetClasses.length === 0) {
        this.logger.log('No asset classes found, scraping entire portfolio without filters.');
        const companies = await this.scrapePortfolioForAllPages(context);
        results.push(...companies);
        return results;
      } else {
        this.logger.log(`Found ${assetClasses.length} asset classes: ${assetClasses.join(', ')}`);

        for (const assetClass of assetClasses) {
          this.logger.log(`Processing asset class: ${assetClass}`);

          try {
            const selected = await this.selectAssetClass(context, assetClass);

            if (selected) {
              const companies = await this.scrapePortfolioForAllPages(context);
              results.push(...companies);

              this.logger.log(
                `Scraped ${companies.length} companies for asset class: ${assetClass}`,
              );
            } else {
              this.logger.warn(`Failed to select asset class: ${assetClass}`);
            }
          } catch (error) {
            this.logger.error(`Error processing asset class ${assetClass}:`, error);
          }

          await sleep(1000 + Math.random() * 500);
        }
      }

      this.logger.log(
        `Total companies scraped: ${results.length}, after deduplication: ${results.length}`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error in scrapePortfolioList:', error);
      throw error;
    }
  }

  /**
   * Scrapes portfolio data for all pages
   */
  private async scrapePortfolioForAllPages(context: PageContext): Promise<ScrappedCompany[]> {
    const allCompanies: ScrappedCompany[] = [];
    let pageNumber = 1;

    await this.loadAllContent(context);
    while (true) {
      this.logger.log(`Scraping page ${pageNumber}`);

      try {
        const pageCompanies = await this.scrapeCurrentPage(context);
        allCompanies.push(...pageCompanies);
        this.logger.log(`Page ${pageNumber}: Found ${pageCompanies.length} companies`);

        const wentToNext = await this.goToNextPage(context);

        if (!wentToNext) {
          this.logger.log(`No more pages available. Finished scraping at page ${pageNumber}`);
          break;
        }
        pageNumber++;

        await context.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      } catch (error) {
        this.logger.error(`Error scraping page ${pageNumber}:`, error);
        break;
      }
    }

    return allCompanies;
  }

  private async selectAssetClass(context: PageContext, assetClass: string): Promise<boolean> {
    const previousSnapshot = await this.getTableSnapshot(context);

    const customSelectSelector = '.cmp-portfolio-filter__custom-select';

    const selected = await context.dataExtractionService.selectCustomDropdownOptionByValue(
      context.page,
      customSelectSelector,
      assetClass,
    );

    if (selected) {
      await this.waitForTableChange(context, previousSnapshot);
    }

    if (!selected) {
      this.logger.warn(`Failed to select asset class: ${assetClass}`);
      return false;
    }

    return true;
  }

  /**
   * Scrapes all rows on the current page
   */
  private async scrapeCurrentPage(context: PageContext): Promise<ScrappedCompany[]> {
    const companies: ScrappedCompany[] = [];
    const rowSelector = '.toggle-table-row-click';

    const rowTableDetails = await this.extractPortfolioTable(context);
    const tableCompanyDetails = this.mapPortfolioTable(rowTableDetails);
    tableCompanyDetails.forEach((company) => this.tryNormalizeAndPush(companies, company));

    const rowCount = await context.page.$$(rowSelector);
    if (!rowCount.length) return companies;

    for (let i = 0; i < rowCount.length; i++) {
      try {
        const rows = await context.page.$$(rowSelector);
        const rowEl = rows[i];
        if (!rowEl) continue;

        await rowEl.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));

        const clicked = await context.dataExtractionService.clickElement(rowEl);
        if (!clicked) continue;

        const rawData = await context.dataExtractionService.extractWithRules<
          Partial<ScrappedCompany>
        >(context.page, this.getPortfolioExtractionRules());

        this.tryNormalizeAndPush(companies, rawData);

        await context.dataExtractionService.click(
          context.page,
          this.getTableSelectors().closeButton,
        );

        await rowEl.dispose();
      } catch (err) {
        this.logger.error(`Error processing row ${i + 1}:`, err);
      }
    }

    return companies;
  }

  private async getAssetClasses(context: PageContext): Promise<string[]> {
    try {
      const assetClassRules: ExtractionRule[] = [
        {
          field: 'options',
          selector: '.cmp-portfolio-filter__item--selectassetclass option',
          attribute: 'value',
          multiple: true,
          transform: (value: string) => value.trim(),
        },
      ];

      const result = await this.dataExtractionService.extractWithRules<{ options: string[] }>(
        context.page,
        assetClassRules,
      );

      return result.options?.filter((option) => option && option.length > 0) || [];
    } catch (error) {
      this.logger.error('Error getting asset classes:', error);
      return [];
    }
  }

  private async waitForTableChange(
    context: PageContext,
    previousSnapshot: string,
    timeout = 5000,
  ): Promise<boolean> {
    const start = Date.now();
    const retryDelay = 100;

    try {
      await withRetry(
        async () => {
          const currentSnapshot = await this.getTableSnapshot(context);

          if (currentSnapshot !== previousSnapshot) {
            return true;
          }

          const elapsed = Date.now() - start;
          if (elapsed >= timeout) {
            throw new Error('Timeout waiting for table to change');
          }

          throw new Error('Table not changed yet');
        },
        Math.ceil(timeout / retryDelay),
        retryDelay,
        false,
      );

      return true;
    } catch {
      return false;
    }
  }

  private async getTableSnapshot(context: PageContext): Promise<string> {
    const rows = await context.page.$$('.toggle-table-row-click');
    const currentSnapshot = await Promise.all(
      rows.map((row) => row.evaluate((el) => el.textContent?.trim() || '')),
    );
    return currentSnapshot.join('|');
  }

  private attachNetworkInterceptor(context: PageContext): void {
    context.page.on('response', (response) => {
      void (async () => {
        try {
          if (response.url().includes('bioportfoliosearch.bioportfoliosearch.json')) {
            const data: ScrapperApiResponse = (await response.json()) as ScrapperApiResponse;
            this.logger.debug(
              `Captured API response: ${response.url()}`,
              JSON.stringify(data.resultsText),
            );

            for (const company of data.results ?? []) {
              const key = company.name?.trim();
              if (!key) continue;

              if (!this.interceptedCompaniesMap.has(key)) {
                const normalized = this.normalizeCompanyData(company);
                if (normalized) {
                  this.interceptedCompaniesMap.set(key, normalized);
                  this.logger.debug(`Added intercepted company: ${key}`);
                }
              } else {
                this.logger.debug(`Skipped merge for existing company: ${key}`);
              }
            }
          }
        } catch (err) {
          this.logger.warn(
            `Failed to parse API response from ${response.url()}`,
            err instanceof Error ? err.message : String(err),
          );
        }
      })();
    });
  }

  private getAllInterceptedData(): ScrappedCompany[] {
    return Array.from(this.interceptedCompaniesMap.values());
  }

  protected mapPortfolioTable(data: Record<string, string>[]): Partial<ScrappedCompany>[] {
    const headerMap: Record<string, keyof ScrappedCompany> = {
      'Portfolio Company': 'name',
      'Asset Class': 'assetClass',
      Industry: 'industry',
      Region: 'region',
    };

    return data.map(
      (row) =>
        Object.fromEntries(
          Object.entries(headerMap)
            .map(([header, key]) => [key, row[header]?.trim() || undefined])
            .filter(([, value]) => value !== undefined),
        ) as Partial<ScrappedCompany>,
    );
  }

  /**
   * Normalizes company data to ensure consistent format
   */
  protected normalizeCompanyData(data: Partial<ScrappedCompany>): ScrappedCompany | undefined {
    if (!data.name) {
      this.logger.debug('Skipping company data - missing required name field');
      return undefined;
    }

    return {
      name: data.name.trim(),
      logo: this.normalizeUrl(data.logo),
      yoi: data?.yoi,
      hq: data.hq?.trim(),
      description: data.description?.trim(),
      industry: data.industry?.trim(),
      assetClass: data.assetClass?.trim(),
      region: data.region?.trim(),
      url: this.normalizeUrl(data.url),
      source: this.config.name,
      scrapedAt: new Date().toISOString(),
      relatedLinkOne: this.normalizeUrl(data.relatedLinkOne),
      relatedLinkTwo: this.normalizeUrl(data.relatedLinkTwo),
      relatedLinks: data.relatedLinks
        ?.map((link) => this.normalizeUrl(link))
        .filter((link): link is string => Boolean(link)),
    };
  }

  /**
   * Attempts to normalize and push company data to results array
   */
  private tryNormalizeAndPush(companies: ScrappedCompany[], data: Partial<ScrappedCompany>): void {
    const normalized = this.normalizeCompanyData(data);
    if (normalized) {
      companies.push(normalized);
    } else {
      this.logger.warn('Skipping company entry due to missing required fields', { data });
    }
  }

  /**
   * Removes duplicate companies based on URL or name
   */
  public deduplicateCompanies(companies: ScrappedCompany[]): ScrappedCompany[] {
    const map = new Map<string, ScrappedCompany>();

    for (const company of companies) {
      const key = company.name?.trim();
      if (!key) {
        this.logger.warn('Skipping company with no identifiable key', { company });
        continue;
      }

      if (map.has(key)) {
        const existing = map.get(key)!;
        const merged = CompanyHelper.mergeScrapedCompanyData(existing, company);
        map.set(key, merged as ScrappedCompany);
        this.logger.debug(`Merged duplicate company: ${key}`);
      } else {
        map.set(key, company);
        this.logger.debug(`Added company: ${company.name}`);
      }
    }

    return Array.from(map.values());
  }

  private async enrichCompaniesFromRelatedLinks(
    page: Page,
    companies: ScrappedCompany[],
  ): Promise<void> {
    for (const company of companies) {
      const links = new Set(
        [company.relatedLinkOne, company.relatedLinkTwo, ...(company.relatedLinks ?? [])]
          .filter((link): link is string => Boolean(link))
          .map((link) => this.normalizeUrl(link)!),
      );

      const uniqueLinks = Array.from(links);
      if (!uniqueLinks.length) continue;

      try {
        const extraDataList = await this.parseRelatedLinks(page, company, uniqueLinks);

        const mergedData = extraDataList.reduce<Partial<ScrappedCompany>>(
          (acc, item) => CompanyHelper.mergeScrapedCompanyData(acc, item),
          {},
        );

        Object.assign(company, mergedData);
      } catch (error) {
        this.logger.error(
          `Failed to enrich company ${company.name} from related links: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async parseRelatedLinks(
    page: Page,
    company: ScrappedCompany,
    links: string[],
  ): Promise<Partial<ScrappedCompany>[]> {
    const results: Partial<ScrappedCompany>[] = [];
    for (const link of links) {
      if (!/\/approach\/shared-success/i.test(link)) continue;

      try {
        await this.navigate(page, link);
        const parsed = await this.parseSharedSuccessPage(page, company);
        results.push(parsed);
      } catch (error) {
        this.logger.error(
          `Failed to parse related link ${link}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return results;
  }

  private async parseSharedSuccessPage(
    page: Page,
    company: ScrappedCompany,
  ): Promise<Partial<ScrappedCompany>> {
    await page.waitForSelector('.cmp-text', { timeout: 5000 }).catch(() => {
      this.logger.warn(`No text elements present in the page`);
    });

    const { fullText, paragraphs } = await page.evaluate(() => {
      const container = document.querySelector('.cmp-text');
      if (!container) return { fullText: '', paragraphs: [] };

      const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
      const texts: string[] = [];
      elements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) texts.push(text);
      });

      return { fullText: texts.slice(0, 10).join(' '), paragraphs: texts.slice(0, 10) };
    });

    const firstParagraph = paragraphs[0] || '';

    const employeeMatch = fullText.match(
      /(?:over|more than|all of its)?\s*([\d,]+\+?)\s*(?:employees|employee-owners|colleagues)/i,
    );
    const employeeCount = employeeMatch ? employeeMatch[1].replace(/,/g, '') : undefined;

    const leadershipText = fullText;

    const executives: string[] = [];
    const leadershipRoles = [
      'CEO',
      'Chairman',
      'President',
      'Deputy Executive Chairman',
      'Managing Director',
      'Executive Director',
      'Director',
      'COO',
      'CFO',
      'CTO',
      'Vice President',
      'Managing Partner',
      'Partner',
      'Chief Executive Officer',
      'Chief Operating Officer',
      'Chief Financial Officer',
      'Chief Technology Officer',
    ];
    const rolesPattern = leadershipRoles.join('|').replace(/\s+/g, '\\s+');

    const leadershipRegex = new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+),?\\s*(${rolesPattern})`,
      'g',
    );
    for (const match of leadershipText.matchAll(leadershipRegex)) {
      const name = match[1].trim();
      const role = match[2].trim();
      if (name && role && !executives.includes(`${name} (${role})`)) {
        executives.push(`${name} (${role})`);
      }
    }

    const prefixRegex = new RegExp(
      `(?:[A-Z]{2,4}\\s+)?(${rolesPattern})\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)`,
      'g',
    );
    for (const match of leadershipText.matchAll(prefixRegex)) {
      const name = match[2].trim();
      const role = match[1].trim();
      if (name && role && !executives.includes(`${name} (${role})`)) {
        executives.push(`${name} (${role})`);
      }
    }
    const acquisitionRegex =
      /(?:In|After|Since|bought|acquired|joined).*?(?:in\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{4}),?\s+([\s\S]*?)(?=\.\s|$)/gi;

    const allMatches: RegExpMatchArray[] = [];
    let m;
    while ((m = acquisitionRegex.exec(fullText)) !== null) {
      allMatches.push(m);
    }

    let extractedYoi: string | undefined;
    let acquisitionReason: string | undefined;
    let selectedMatch: RegExpMatchArray | undefined;

    if (allMatches.length === 1) {
      selectedMatch = allMatches[0];
    } else if (allMatches.length > 1 && company.yoi) {
      const investYear = company.yoi;
      selectedMatch = allMatches.find((match) => match[1].includes(investYear));
    }

    if (selectedMatch) {
      extractedYoi = selectedMatch[1];
      acquisitionReason = selectedMatch[2]?.trim() || firstParagraph;
    } else {
      acquisitionReason = firstParagraph;
    }

    return {
      employeeCount: employeeCount ?? company.employeeCount,
      executiveMembers: executives.length ? executives : company.executiveMembers,
      yoi: extractedYoi ?? company.yoi,
      ownershipDetails: acquisitionReason ?? company.ownershipDetails,
    };
  }
}
