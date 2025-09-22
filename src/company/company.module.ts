import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyDocumentFeature } from './schema/company.schema';
import { CompanyRepository } from './company.repository';
import { CompanyService } from './company.service';

@Module({
  imports: [MongooseModule.forFeature(CompanyDocumentFeature)],
  providers: [CompanyRepository, CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
