import { Injectable } from '@nestjs/common';
import { Model, UpdateQuery } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { HQLocation } from './schema/hq-location.schema';
import { DatabaseRepository } from '../database/database.repository';

@Injectable()
export class LocationRepository extends DatabaseRepository<HQLocation> {
  constructor(
    @InjectModel(HQLocation.name)
    readonly model: Model<HQLocation>,
  ) {
    super(model);
  }

  /** Update an existing HQ location or Add by HQ string */
  async updateByHQ(
    hq: string,
    update: UpdateQuery<HQLocation> | Partial<HQLocation>,
    upsert = false,
  ): Promise<HQLocation | null> {
    return this.update({ hq }, update, { new: true, upsert });
  }
}
