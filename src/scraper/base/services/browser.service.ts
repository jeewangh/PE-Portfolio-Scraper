import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, LaunchOptions, Page } from 'puppeteer';
import { getRandomUserAgent } from '../../../utils/user-agents';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;

  private readonly defaultOptions: LaunchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--ignore-certificate-errors',
    ],
  };

  async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch(this.defaultOptions);
      this.logger.log('Browser instance created with stealth plugin');
    }
    return this.browser;
  }

  async createPage(options?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    timeout?: number;
    appName?: string;
    contact?: string;
  }): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    const timeout = options?.timeout ?? 30000;
    page.setDefaultNavigationTimeout(timeout);
    page.setDefaultTimeout(timeout);

    const userAgent = options?.userAgent ?? getRandomUserAgent(options?.appName, options?.contact);
    await page.setUserAgent({ userAgent: userAgent });

    await page.setViewport(options?.viewport ?? { width: 1920, height: 1080 });

    this.logger.debug(`Created page with User-Agent: ${userAgent.substring(0, 80)}...`);

    return page;
  }

  async closePage(page: Page): Promise<void> {
    try {
      page.removeAllListeners();
      await page.close();
    } catch (error: any) {
      this.logger.warn(`Error closing page: ${error instanceof Error ? error.message : error}`);
    }
  }

  async closeBrowser(): Promise<void> {
    try {
      await this.browser?.close();
    } catch (error: any) {
      this.logger.warn(`Error closing browser: ${error instanceof Error ? error.message : error}`);
    }
  }

  async cleanup(page: Page): Promise<void> {
    await this.closePage(page);
    await this.closeBrowser();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log('Browser instance closed');
      } catch (error: any) {
        this.logger.error(
          `Error closing browser: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
