import { Module } from '@nestjs/common';
import { LocationService } from './location.service';
import { MongooseModule } from '@nestjs/mongoose';
import { HQLocationCacheFeature } from './schema/hq-location.schema';
import { LocationRepository } from './location.repository';

@Module({
  imports: [MongooseModule.forFeature(HQLocationCacheFeature)],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}
