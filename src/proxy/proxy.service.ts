import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyRepository } from './proxy.repository';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Agent as HttpsAgent } from 'https';
import axios from 'axios';

type AxiosInstance = ReturnType<typeof axios.create>;

interface AxiosConfigWithAgent {
  timeout?: number;
  httpAgent?: any;
  httpsAgent?: any;
}

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly logger = new Logger(ProxyService.name);

  private proxyCache: string[] = [];
  private lastCacheUpdate = 0;
  private cacheTTL = 5 * 60 * 1000;

  private readonly minProxies = 10;

  private refreshing: Promise<void> | null = null;

  private readonly proxySources: string[] = [
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://proxy.webshare.io/api/proxy/list/',
  ];

  constructor(private readonly proxyRepo: ProxyRepository) {}

  onModuleInit() {
    this.refreshProxyCache().catch((err) => this.logger.error(err));

    setInterval(() => {
      this.refreshProxyCache().catch((err) => this.logger.error(err));
    }, this.cacheTTL);
  }

  private async refreshProxyCache() {
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        let validProxies = await this.proxyRepo.getValidProxies();

        if (validProxies.length < this.minProxies) {
          this.logger.log(
            `Proxy DB has ${validProxies.length} proxies, which is below minimum of ${this.minProxies}, fetching new proxies...`,
          );
          await this.fetchAndStoreProxies(false);
          validProxies = await this.proxyRepo.getValidProxies();
        }

        this.proxyCache = validProxies.map((p) => p.proxy).filter(Boolean);
        this.lastCacheUpdate = Date.now();
        this.logger.log(`Proxy cache refreshed. ${this.proxyCache.length} proxies cached.`);
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  private getCachedProxy(): string | null {
    const needsRefresh =
      !this.proxyCache.length || Date.now() - this.lastCacheUpdate > this.cacheTTL;

    if (needsRefresh) {
      this.refreshProxyCache();
    }

    if (!this.proxyCache.length) {
      this.logger.warn('No proxies available, falling back to direct request.');
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.proxyCache.length);
    return this.proxyCache[randomIndex];
  }

  private getAxiosConfig(proxy: string | null, timeout = 5000): AxiosConfigWithAgent {
    const agent = proxy ? new HttpsProxyAgent(`http://${proxy}`) : new HttpsAgent({ family: 4 });
    return { timeout, httpAgent: agent, httpsAgent: agent };
  }

  async getAxiosWithProxy(timeout = 5000): Promise<AxiosInstance> {
    const proxyPromise = (async () => {
      let proxy = this.getCachedProxy();
      if (!proxy) {
        return null;
      }

      const isValid = await this.validateProxy(proxy);
      if (!isValid) {
        await this.proxyRepo.removeProxy(proxy);
        this.proxyCache = this.proxyCache.filter((p) => p !== proxy);
        proxy = this.getCachedProxy();
        if (!proxy) return null;
      }

      return proxy;
    })();

    const fallbackTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));

    const proxy = await Promise.race([proxyPromise, fallbackTimeout]);

    if (!proxy) {
      this.logger.warn('Proxy resolution timed out after 1s, falling back to direct request.');
      return axios.create({ timeout });
    }

    const agent = new HttpsProxyAgent(`http://${proxy}`);
    return axios.create({ timeout, httpAgent: agent, httpsAgent: agent } as AxiosConfigWithAgent);
  }

  async validateProxy(proxy: string): Promise<boolean> {
    try {
      const agent = new HttpsProxyAgent(`http://${proxy}`);
      await axios.head('https://api.ipify.org', {
        httpsAgent: agent,
        timeout: 5000,
      } as AxiosConfigWithAgent);
      this.logger.log(`Proxy validated successfully: ${proxy}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Proxy validation failed: ${proxy} - ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.proxyRepo.incrementFailures(proxy);

      const proxyDoc = await this.proxyRepo.getValidProxies();
      const proxyEntry = proxyDoc.find((p) => p.proxy === proxy);
      if (proxyEntry && proxyEntry.failures >= 1) await this.proxyRepo.removeProxy(proxy);
      return false;
    }
  }

  async fetchAndStoreProxies(useProxy = true): Promise<void> {
    const allProxies: Set<string> = new Set();

    for (const source of this.proxySources) {
      try {
        const axiosInstance = useProxy
          ? await this.getAxiosWithProxy()
          : axios.create(this.getAxiosConfig(null, 10000));
        const response = await axiosInstance.get<string>(source);
        const proxies = response.data
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter((p) => p && /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(p));

        proxies.forEach((proxy) => allProxies.add(proxy));
      } catch (err) {
        this.logger.error(
          `Failed fetching proxies from ${source}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (allProxies.size) {
      const ttl = new Date(Date.now() + 24 * 3600 * 1000);
      const proxiesToStore = Array.from(allProxies).map((proxy) => ({ proxyIpPort: proxy, ttl }));
      await this.proxyRepo.saveProxies(proxiesToStore);
    }
  }
}
