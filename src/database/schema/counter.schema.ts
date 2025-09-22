import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ModelDefinition } from '@nestjs/mongoose/dist/interfaces';
import { Document } from 'mongoose';

export interface CounterInterface {
  name: string;
  seq: number;
}

@Schema()
export class Counter implements CounterInterface {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export type CounterDocument = Counter & Document;

export const CounterSchema = SchemaFactory.createForClass(Counter);

export const CounterFeature: ModelDefinition[] = [{ name: Counter.name, schema: CounterSchema }];
