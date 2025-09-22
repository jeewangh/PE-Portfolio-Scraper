import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NominatimResponse } from './types/nominatim-response-i';
import { getRandomUserAgent } from '../utils/user-agents';
import { normalizeUSState } from '../utils/state-normalizer.utils';
import { LocationRepository } from './location.repository';
import axios from 'axios';
import { withRetry } from '../utils/time.utils';

@Injectable()
export class LocationService implements OnModuleInit {
  private readonly logger = new Logger(LocationService.name);

  private geocodeCache = new Map<string, { city?: string; state?: string; country?: string }>();

  constructor(private readonly hqRepo: LocationRepository) {}

  async onModuleInit() {
    await this.initCache();
  }

  async initCache(): Promise<void> {
    const allHQs = await this.hqRepo.findAll();
    for (const record of allHQs) {
      if (record.hq) {
        this.geocodeCache.set(record.hq, {
          city: record.city,
          state: record.state,
          country: record.country,
        });
      }
    }
    this.logger.log(`Loaded ${allHQs.length} HQ records into memory cache`);
  }

  async parseHQ(hq: string): Promise<{ city?: string; state?: string; country?: string }> {
    const trimmedHQ = hq.trim();
    const parts = trimmedHQ
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (this.geocodeCache.has(trimmedHQ)) {
      return this.geocodeCache.get(trimmedHQ)!;
    }

    const cachedFromDB = await this.hqRepo.findOne({ hq: trimmedHQ });
    if (cachedFromDB) {
      this.geocodeCache.set(trimmedHQ, cachedFromDB);
      return cachedFromDB;
    }

    if (parts.length === 1 || parts.length === 3) return this.simpleParse(trimmedHQ);

    try {
      const geoData = await this.geocodeHQ(trimmedHQ);
      if (geoData) {
        this.geocodeCache.set(trimmedHQ, geoData);
        await this.hqRepo.updateByHQ(
          trimmedHQ,
          { $setOnInsert: { hq: trimmedHQ, ...geoData } },
          true,
        );
        return geoData;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to geocode "${trimmedHQ}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.simpleParse(trimmedHQ);
  }

  private async geocodeHQ(
    hq: string,
  ): Promise<{ city?: string; state?: string; country?: string } | undefined> {
    const trimmedHQ = hq.trim();

    if (this.geocodeCache.has(trimmedHQ)) {
      return this.geocodeCache.get(trimmedHQ);
    }

    try {
      const geoData = await withRetry(
        async () => {
          const response = await axios.get<NominatimResponse[]>(
            'https://nominatim.openstreetmap.org/search',
            {
              params: { q: trimmedHQ, format: 'json', addressdetails: 1, limit: 1 },
              headers: {
                'User-Agent': getRandomUserAgent('Geo Location', 'randommail@google.com'),
                'Accept-Language': 'en',
              },
              timeout: 2000,
            },
          );

          const data = response.data;
          if (!Array.isArray(data) || data.length === 0) return undefined;

          const addr = data[0].address ?? {};
          return {
            city: addr.city ?? addr.town ?? addr.village ?? addr.hamlet,
            state: addr.state,
            country: addr.country,
          };
        },
        5,
        1000, // Delay is 1 second respecting nominatim's free api limit
        true,
        (attempt, error) => {
          this.logger.warn(
            `Geocoding attempt ${attempt} for "${trimmedHQ}" failed: ${error.message}`,
          );
        },
      );

      if (geoData) {
        this.geocodeCache.set(trimmedHQ, geoData);
      }

      return geoData;
    } catch (err) {
      this.logger.warn(
        `Failed geocoding "${trimmedHQ}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private simpleParse(hq: string): { city?: string; state?: string; country?: string } {
    const parts = hq
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    let city, state, country;

    if (parts.length === 1) {
      country = parts[0];
    } else if (parts.length === 2) {
      [city, country] = parts;
    } else {
      [city, state, country] = parts;
    }

    if (country?.toLowerCase() === 'usa') {
      country = 'United States';
    }

    if (state) {
      state = normalizeUSState(state, country);
    }

    return { city, state, country };
  }
}
