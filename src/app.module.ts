import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScraperModule } from './scraper/scraper.module';
import { DatabaseModule } from './database/database.module';
import { CompanyModule } from './company/company.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const isProd = process.env.NODE_ENV === 'production';
const clientPath = isProd ? join(__dirname, 'client') : join(process.cwd(), 'src/client');

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: clientPath,
      serveRoot: '/home',
    }),
    ScraperModule,
    DatabaseModule,
    CompanyModule,
  ],
})
export class AppModule {}
