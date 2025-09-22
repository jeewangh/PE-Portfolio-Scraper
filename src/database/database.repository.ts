import { Injectable } from '@nestjs/common';
import { Model, Document, FilterQuery, UpdateQuery } from 'mongoose';

@Injectable()
export class DatabaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findAll(filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async save(doc: Partial<T>): Promise<T> {
    const created = new this.model(doc);
    return created.save();
  }

  async update(
    filter: FilterQuery<T>,
    update: UpdateQuery<T> | Partial<T>,
    options: { upsert?: boolean; new?: boolean } = { new: true },
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, update, options).exec();
  }

  async delete(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOneAndDelete(filter).exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
