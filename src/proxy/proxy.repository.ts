import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Proxy, ProxyDocument } from './proxy.schema';
import { Model } from 'mongoose';
import { DatabaseRepository } from '../database/database.repository';

@Injectable()
export class ProxyRepository extends DatabaseRepository<ProxyDocument> {
  constructor(@InjectModel(Proxy.name) private proxyModel: Model<ProxyDocument>) {
    super(proxyModel);
  }

  async saveProxies(
    proxies: {
      proxyIpPort: string;
      ttl: Date;
    }[],
  ): Promise<void> {
    for (const proxy of proxies) {
      await this.proxyModel.updateOne(
        { proxy: proxy.proxyIpPort },
        { $set: { ttl: proxy.ttl, failures: 0 } },
        { upsert: true },
      );
    }
  }

  async getValidProxies(): Promise<Proxy[]> {
    return this.proxyModel
      .find({ ttl: { $gt: new Date() }, failures: { $lt: 1 } })
      .lean()
      .exec();
  }

  async removeProxy(proxy: string): Promise<void> {
    await this.proxyModel.deleteOne({ proxy }).exec();
  }

  async incrementFailures(proxyIpPort: string): Promise<void> {
    await this.proxyModel.updateOne({ proxyIpPort }, { $inc: { failures: 1 } });
  }
}
