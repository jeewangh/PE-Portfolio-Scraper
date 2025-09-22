import { Injectable, Logger } from '@nestjs/common';
import { ElementHandle, Page } from 'puppeteer';

export interface ExtractionRule<Output = unknown> {
  field: string;
  selector: string;
  attribute?: string;
  transform?: (value: string) => Output;
  multiple?: boolean;
  required?: boolean;
}

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);

  async extractWithRules<T extends Record<string, unknown>>(
    page: Page,
    rules: ExtractionRule[],
  ): Promise<T> {
    const result: Partial<T> = {};

    for (const rule of rules) {
      try {
        let rawValue: string | string[] | null;

        if (rule.multiple) {
          rawValue = rule.attribute
            ? await this.getAttributes(page, rule.selector, rule.attribute)
            : await this.getTexts(page, rule.selector);
        } else {
          rawValue = rule.attribute
            ? await this.getAttribute(page, rule.selector, rule.attribute)
            : await this.getText(page, rule.selector);
        }

        let finalValue: unknown = rawValue;
        if (rawValue !== null && rule.transform) {
          if (Array.isArray(rawValue)) {
            finalValue = rawValue.map((v) => rule.transform!(v));
          } else {
            finalValue = rule.transform(rawValue);
          }
        }

        if (
          rule.required &&
          (finalValue === null ||
            finalValue === undefined ||
            (Array.isArray(finalValue) && finalValue.length === 0))
        ) {
          this.logger.warn(`Required field "${rule.field}" is missing or empty`);
        }

        result[rule.field as keyof T] = finalValue as T[keyof T];
      } catch (error: unknown) {
        this.logger.error(
          `Error extracting field "${rule.field}"`,
          error instanceof Error ? error.stack : String(error),
        );
        if (rule.required) {
          throw error;
        }
      }
    }

    return result as T;
  }

  async extractTable(
    page: Page,
    tableSelector: string,
    options?: {
      headerSelector?: string;
      rowSelector?: string;
      cellSelector?: string;
    },
  ): Promise<Record<string, any>[]> {
    const {
      headerSelector = 'thead th',
      rowSelector = 'tbody tr',
      cellSelector = 'td',
    } = options || {};

    const headers = await this.getTexts(page, `${tableSelector} ${headerSelector}`);

    this.logger.warn(headers.length > 0 ? 'table found' : 'table not found');

    const rows = await page.$$eval(
      `${tableSelector} ${rowSelector}`,
      (rows, cellSel) => {
        return rows.map((row) => {
          const cells = row.querySelectorAll(cellSel);
          return Array.from(cells).map((cell) => cell.textContent?.trim() || '');
        });
      },
      cellSelector,
    );

    return rows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
  }

  async getText(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.$eval(selector, (el) => el.textContent?.trim() || null);
    } catch {
      return null;
    }
  }

  async getTexts(page: Page, selector: string): Promise<string[]> {
    try {
      return await page.$$eval(selector, (elements) =>
        elements.map((el) => el.textContent?.trim() || '').filter(Boolean),
      );
    } catch {
      return [];
    }
  }

  async getAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
    try {
      return await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } catch {
      return null;
    }
  }

  async getAttributes(page: Page, selector: string, attribute: string): Promise<string[]> {
    try {
      return await page.$$eval(
        selector,
        (elements, attr) =>
          elements.map((el) => el.getAttribute(attr)).filter((val): val is string => val !== null),
        attribute,
      );
    } catch {
      return [];
    }
  }

  async click(
    page: Page,
    selector: string,
    options?: {
      delay?: number;
      waitForNavigation?: boolean;
      timeout?: number;
    },
  ): Promise<boolean> {
    try {
      const el = await page.waitForSelector(selector, {
        visible: true,
        timeout: options?.timeout ?? 5000,
      });
      if (!el) return false;

      if (options?.waitForNavigation) {
        await Promise.all([page.waitForNavigation(), el.click({ delay: options?.delay })]);
      } else {
        await el.click({ delay: options?.delay });
      }
      return true;
    } catch (error) {
      this.logger.warn(`Failed to click element: ${selector}`, error);
      return false;
    }
  }

  async selectCustomDropdownOptionByValue(
    page: Page,
    customSelectSelector: string,
    value: string,
  ): Promise<boolean> {
    try {
      const success = await page.$eval(
        customSelectSelector,
        (customSelect, value) => {
          const select = customSelect.querySelector('select');
          if (!select) return false;

          // find the <option> with the target value
          const option = Array.from(select.options).find((o) => o.value === value);
          if (!option) return false;

          // set the native select value and trigger change event
          select.value = value;
          select.dispatchEvent(new Event('change', { bubbles: true }));

          // dynamically find the container with dropdown divs
          const divContainer = Array.from(customSelect.children).find(
            (c) => c !== select && c.querySelectorAll && c.querySelectorAll('div').length > 0,
          );

          if (!divContainer) return false;

          const optionDivs = Array.from(divContainer.querySelectorAll('div'));
          const targetDiv = optionDivs.find(
            (d) => d.textContent?.trim() === option.textContent?.trim(),
          );
          if (!targetDiv) return false;

          targetDiv.click(); // triggers site JS
          return true;
        },
        value,
      );

      if (!success) {
        this.logger.warn(`Failed to select value "${value}" in ${customSelectSelector}`);
      }

      return success;
    } catch (err) {
      this.logger.warn(`Error selecting value "${value}" in ${customSelectSelector}`, err);
      return false;
    }
  }

  async clickElement(
    element: ElementHandle<Element>,
    options?: { delay?: number },
  ): Promise<boolean> {
    try {
      await element.click({ delay: options?.delay });
      return true;
    } catch (error) {
      this.logger.warn(`Failed to click element handle`, error);
      return false;
    }
  }
}
