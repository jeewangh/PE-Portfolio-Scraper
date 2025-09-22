import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CounterFeature } from './schema/counter.schema';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mongoUrl = config.get<string>('MONGO_URL');
        if (!mongoUrl) {
          throw new Error('MONGO_URL environment variable is required');
        }
        return {
          uri: mongoUrl,
          autoIndex: true,
          retryWrites: true,
          w: 'majority',
        };
      },
    }),
    MongooseModule.forFeature(CounterFeature),
  ],
})
export class DatabaseModule {}
