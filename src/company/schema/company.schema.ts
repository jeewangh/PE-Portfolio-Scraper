import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ModelDefinition } from '@nestjs/mongoose/dist/interfaces';
import { Document } from 'mongoose';
import {
  CompanyInterface,
  General,
  Location,
  Industry,
  Ownership,
} from '../../types/scrapper/kkr/company-data-model.i';
import { Counter } from '../../database/schema/counter.schema';

@Schema({ _id: false })
export class GeneralSchema implements General {
  @Prop({ required: true })
  name!: string;

  @Prop() description?: string;
  @Prop() websiteUrl?: string;
  @Prop() logoUrl?: string;
  @Prop() relevantLinks?: string[];

  @Prop()
  employeeCount?: string;

  @Prop()
  executiveMembers?: string[];
}

@Schema({ _id: false })
export class LocationSchema implements Location {
  @Prop() hq?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() country?: string;
}

@Schema({ _id: false })
export class IndustrySchema implements Industry {
  @Prop() industryType?: string;
}

@Schema({ _id: false })
export class OwnershipSchema implements Ownership {
  @Prop({ type: [String], default: [] })
  operatingRegion?: string[];

  @Prop() yearSinceInvestment?: string;

  @Prop({ type: [String], default: [] })
  assetClasses?: string[];

  @Prop()
  investmentInterest?: string;
}

@Schema({ timestamps: true })
export class Company implements CompanyInterface {
  @Prop({ unique: true })
  companyId!: number;

  @Prop({ type: GeneralSchema, required: true })
  general!: General;

  @Prop({ type: LocationSchema })
  location?: Location;

  @Prop({ type: IndustrySchema })
  industry?: Industry;

  @Prop({ type: OwnershipSchema })
  ownership?: Ownership;

  createdAt?: Date;
  updatedAt?: Date;
}

export type CompanyDocument = Company & Document;

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.pre<CompanyDocument>('save', async function (next) {
  if (this.isNew) {
    try {
      const counterModel = this.db.model<Document & { seq: number }>(Counter.name);

      const counter = await counterModel.findOneAndUpdate(
        { name: Company.name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      this.companyId = counter.seq;
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

export const CompanyDocumentFeature: ModelDefinition[] = [
  {
    name: Company.name,
    schema: CompanySchema,
  },
];
