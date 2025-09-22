import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class HQLocation extends Document {
  @Prop({ required: true, unique: true, index: true })
  hq!: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  country?: string;
}

const HQLocationCacheSchema = SchemaFactory.createForClass(HQLocation);

export const HQLocationCacheFeature: ModelDefinition[] = [
  {
    name: HQLocation.name,
    schema: HQLocationCacheSchema,
  },
];
