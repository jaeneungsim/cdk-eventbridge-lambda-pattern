# AWS CDK SQS-Lambda Pattern

A production-ready serverless web application pattern using AWS CDK that provides resilient, asynchronous request processing through SQS queues.

## Why This Pattern?

Traditional synchronous API patterns fail under real-world conditions:

- **Traffic spikes** overwhelm Lambda concurrency limits, causing request failures
- **Network timeouts** on mobile/unstable connections lose user data
- **External service outages** break entire application workflows
- **Cost inefficiency** from always-on infrastructure during low-traffic periods

This pattern solves these issues by:
- **Buffering requests** in SQS during traffic surges
- **Guaranteeing request capture** before network issues occur
- **Automatic retry** with dead letter queues for failed processing
- **Pay-per-use** scaling that reduces costs during off-peak hours

## Architecture

```
┌─────────────┐    ┌─────────┐    ┌──────────────┐    ┌─────────────┐
│   Browser   │───▶│   WAF   │───▶│  CloudFront  │───▶│  S3 (Web)   │
└─────────────┘    └─────────┘    └──────────────┘    └─────────────┘
                                           │
                                           ▼
                                  ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
                                  │ API Gateway  │───▶│ SQS Queue   │───▶│   Lambda    │
                                  └──────────────┘    └─────────────┘    └─────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────┐
                                                    │ Dead Letter │
                                                    │   Queue     │
                                                    └─────────────┘
```

**Request Flow:**
1. API Gateway immediately accepts requests and queues them in SQS
2. Lambda functions process messages asynchronously from the queue
3. Failed messages retry automatically, then move to Dead Letter Queue
4. Frontend served via CloudFront from S3 for global performance

## Project Structure

```
├── bin/
│   └── cdk-sqs-lambda-pattern.ts     # CDK app entry point
├── lib/
│   └── cdk-sqs-lambda-pattern-stack.ts # Stack definitions
├── lambda/
│   ├── sample-lambda-1/
│   │   └── index.js                  # Message processor 1
│   └── sample-lambda-2/
│       └── index.js                  # Message processor 2
├── web/
│   └── index.html                    # Frontend application
└── test/
    └── *.test.ts                     # Unit tests
```

## Key Components

### Multi-Stack Architecture
- **WafStack**: Security layer with rate limiting (us-east-1)
- **BackendStack**: API Gateway, SQS queues, Lambda functions
- **FrontendStack**: CloudFront distribution and S3 hosting

### SQS Configuration
- **Visibility Timeout**: 60 seconds (2x Lambda timeout)
- **Dead Letter Queue**: After 3 failed attempts
- **Batch Processing**: Up to 10 messages per Lambda invocation
- **Message Retention**: 14 days

### Security Features
- WAF with rate limiting (2000 requests per 5 minutes)
- Origin Access Control for S3
- IAM least privilege access
- CORS configuration for cross-origin requests

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- CDK CLI installed: `npm install -g aws-cdk`

### Deploy

```bash
# Clone and install
git clone https://github.com/jaeneungsim/cdk-sqs-lambda-pattern.git
cd cdk-sqs-lambda-pattern
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all

# Test the endpoints
curl -X POST https://your-cloudfront-url/api/sample-lambda-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello World"}'
```

### Outputs
After deployment, you'll get:
- **CloudFront URL**: Access your web application
- **API Gateway URL**: Direct API access (bypasses CloudFront)
- **SQS Queue URLs**: For monitoring message processing

## Testing

The web interface provides buttons to test both Lambda functions:
1. Open the CloudFront URL in your browser
2. Click "Test Sample Lambda 1" or "Test Sample Lambda 2"
3. Messages are queued immediately and processed asynchronously
4. Check CloudWatch logs to see message processing

## Monitoring

Essential CloudWatch metrics to monitor:
- **Queue Depth**: `ApproximateNumberOfVisibleMessages`
- **Processing Lag**: `ApproximateAgeOfOldestMessage`
- **Dead Letter Queue**: Messages requiring manual intervention
- **Lambda Errors**: Processing failures and throttling

## Production Considerations

### Environment Configuration
```typescript
// Different settings per environment
const config = {
  dev: { rateLimitRpm: 1000, lambdaConcurrency: 10 },
  prod: { rateLimitRpm: 10000, lambdaConcurrency: 100 }
};
```

### Cost Optimization
- Lambda functions only run when processing messages
- CloudFront caching reduces origin requests
- SQS charges only for message operations
- No idle infrastructure costs

### Scaling
- API Gateway: Handles 10,000+ concurrent requests
- SQS: Unlimited message throughput
- Lambda: Auto-scales based on queue depth
- CloudFront: Global edge caching

## Extending the Pattern

### Add New Message Processors
```typescript
// Add new Lambda function
const newProcessor = new lambda.Function(this, 'NewProcessor', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/new-processor')
});

// Connect to SQS queue
newProcessor.addEventSource(new eventsources.SqsEventSource(newQueue));
```

### Common Extensions
- **Database Integration**: DynamoDB, RDS connections
- **Notification Systems**: Email, SMS, push notifications
- **File Processing**: S3 uploads, image resizing
- **External APIs**: Third-party service integrations

## Useful Commands

```bash
# List all stacks
cdk ls

# Deploy specific stack
cdk deploy BackendStack

# View differences before deploy
cdk diff

# Destroy all resources
cdk destroy --all

# Generate CloudFormation template
cdk synth
```

## When to Use This Pattern

**Best for:**
- E-commerce platforms with variable traffic
- User registration/onboarding systems
- File upload and processing workflows
- Integration with unreliable external services
- Applications requiring audit trails

**Consider alternatives for:**
- Real-time applications needing immediate responses
- Simple CRUD operations with consistent load
- Applications with strict latency requirements (< 100ms)

## License

MIT License - Use this pattern for building resilient serverless applications.