import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProxyFeature } from './proxy.schema';
import { ProxyService } from './proxy.service';
import { ProxyRepository } from './proxy.repository';

//Disabling this since the proxy service has been too unreliable
@Module({
  imports: [MongooseModule.forFeature(ProxyFeature)],
  providers: [ProxyService, ProxyRepository],
  exports: [ProxyService],
})
export class ProxyModule {}
