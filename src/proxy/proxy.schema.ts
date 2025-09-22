import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ModelDefinition } from '@nestjs/mongoose/dist/interfaces';

@Schema({ timestamps: true })
export class Proxy {
  @Prop({ required: true, unique: true })
  proxy!: string; // 'ip:port'

  @Prop({ required: true })
  ttl!: Date;

  @Prop({ default: 0 })
  failures!: number;
}

export type ProxyDocument = Proxy & Document;

export const ProxySchema = SchemaFactory.createForClass(Proxy);

export const ProxyFeature: ModelDefinition[] = [
  {
    name: Proxy.name,
    schema: ProxySchema,
  },
];
