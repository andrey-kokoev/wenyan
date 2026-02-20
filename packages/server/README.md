# Wenyan Server

A Hono-based API server for document analysis built for Cloudflare Workers.

## Features

- **Modern Framework**: Built with Hono for optimal Cloudflare Workers performance
- **TypeScript**: Full type safety with TypeScript
- **Document Analysis API**: Ready for PDF, DOCX, TXT, and Markdown file processing
- **Health Checks**: Comprehensive health and readiness endpoints
- **Structured Responses**: Consistent API response format
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Request Tracing**: Request IDs for debugging and monitoring

## Getting Started

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Installation

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Set up environment variables
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

### Development

```bash
# Start local development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

### Deployment

```bash
# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging
```

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/ping` - Simple ping test

### Document Analysis

- `POST /documents/upload` - Upload a document for analysis
- `GET /documents/:documentId/status` - Get document processing status
- `POST /documents/:documentId/analyze` - Start document analysis
- `GET /documents/:documentId/analysis/:analysisId` - Get analysis results
- `GET /documents` - List all documents
- `DELETE /documents/:documentId` - Delete a document

### System

- `GET /` - API information
- `GET /api` - Detailed API documentation

## Configuration

### Environment Variables

The following environment variables are configured in `wrangler.toml`:

- `ENVIRONMENT` - Current environment (development/staging/production)

### Cloudflare Resources

The server is configured to use the following Cloudflare services (commented out by default):

- **KV Namespaces**: For caching
- **D1 Database**: For document metadata and analysis results
- **R2 Storage**: For file storage
- **Durable Objects**: For WebSocket connections

To enable these services:

1. Uncomment the relevant sections in `wrangler.toml`
2. Create the resources in your Cloudflare account
3. Update the configuration with your resource IDs

## Project Structure

```
src/
├── index.ts           # Main Hono application
├── middleware/
│   └── common.ts     # Shared middleware (CORS, logging, etc.)
├── routes/
│   ├── health.ts     # Health check endpoints
│   └── documents.ts  # Document analysis endpoints
├── types/
│   └── env.ts        # TypeScript environment types
└── utils/
    └── helpers.ts    # Utility functions
```

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Keep functions small and focused
- Use proper error handling

### API Design

- All responses follow a consistent format
- Use appropriate HTTP status codes
- Include request IDs for tracing
- Validate input with Zod schemas

### Testing

```bash
# Run tests
npm test
```

## License

MIT License - see LICENSE file for details.