# Portfolio Company Scraper

A modular web scraping application built on NestJS for extracting portfolio company data from private equity firms.
Currently supports KKR portfolio companies.

## Environment Setup

1. Copy the example environment file:

```
cp .env.template .env
 ```

2. Edit .env to configure environment variables, e.g.:

```
PORT=3000
NODE_ENV=development
MONGO_URL=mongodb://<username>:<password>@localhost:<host_port>/<database>?authSource=admin
```
```Replace placeholders (<username>, <password>, <host_port>, <database>) with your own values.```

## MongoDB Setup

If you don’t have MongoDB installed locally, you can quickly start a container using Docker:

```
docker run -d \
  --name <container_name> \
  -p <host_port>:<container_port> \
  -e MONGO_INITDB_ROOT_USERNAME=<username> \
  -e MONGO_INITDB_ROOT_PASSWORD=<password> \
  mongo:<version>

``` 

After starting the container, your `.env` can reference it like:

```
MONGO_URL=mongodb://<username>:<password>@localhost:<host_port>/<database>?authSource=admin
```

## Install Dependencies

```npm install```

## Start the application in development mode:

```npm run dev```

## Adding a New Scraping Strategy

1. Create a New Strategy Class
   Navigate to `src/scrapper/<provider>/` or create a new folder for your provider. Extend BaseScraperStrategy<T> with
   your scraping logic.

2. Create a Service to Use the Strategy
   Implement a service that utilizes your strategy for scraping and saving data.

3. Register Your Strategy in the Module
   Add your service and strategy to the corresponding NestJS module.

## Deployment and hosting

This has been deployed to Docker Hub and automatically integrated using `Render Hooks`

Site: https://pe-portfolio-company-scraper.onrender.com/home/

### Note:

<i> Currently proxy service is disabled because it did not work reliably with free proxy providers </i>

##  Focus Areas for Future Improvements:
   1. Fixing & Enhancing proxy and scraping reliability
   2. Extracting meaningful information from unstructured sources leveraging LLMs
   3. Adding support for additional private equity firms

