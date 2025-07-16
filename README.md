# EventBridge Lambda Pattern with CDK

A serverless architecture pattern demonstrating EventBridge-driven Lambda processing with conditional logic. This project illustrates solutions to common implementation challenges I've encountered in production environments, focusing on clear pattern demonstration rather than production-ready code.

## Architecture

```
Browser → CloudFront → API Gateway → Lambda1 → EventBridge → SQS → Lambda2
```

**Request Flow:**
1. **API Gateway** receives GET requests with score parameter
2. **Lambda1** validates score and responds immediately to user
3. **EventBridge** receives events for scores < 50 or missing scores
4. **SQS** queues EventBridge events for reliable processing
5. **Lambda2** processes low-score events asynchronously

## When to Use This Pattern

### Ideal For:
- **Business rule validation** with downstream processing
- **Audit trails** for failed validations
- **Async notifications** based on conditions
- **Event-driven microservices** with decoupled components
- **High-throughput APIs** requiring fast response times

### Use Cases:
- Credit score checks with follow-up actions
- Order validation with inventory updates
- User registration with verification workflows
- Content moderation with review queues

## Key Features

### **Key Components**
- **Multi-region deployment** (WAF: us-east-1, Backend: ap-southeast-2)
- **CloudFront CDN** with automatic cache invalidation
- **Dead Letter Queues** for error handling
- **EventBridge custom bus** for event isolation
- **Batch processing** with individual failure handling

### **Performance Optimizations**
- **Asynchronous EventBridge calls** for faster response times
- **CloudFront caching** with query parameter forwarding
- **Lambda proxy integration** for efficient API Gateway setup
- **SQS batching** for optimal throughput

## Quick Start

### Prerequisites
- Node.js 20+
- AWS CLI configured
- CDK CLI: `npm install -g aws-cdk`

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd cdk-eventbridge-lambda-pattern
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all
```

### Configuration

Set your AWS profile if needed:
```bash
export AWS_PROFILE=your-profile-name
```

## Testing

### Web Interface
1. Open the CloudFront URL from deployment output
2. Test different score scenarios:
   - **High Score (≥50)**: Direct Lambda1 response
   - **Low Score (<50)**: Triggers EventBridge → SQS → Lambda2
   - **Missing Score**: Same as low score flow

### API Testing
```bash
# High score - immediate response
curl "https://your-cloudfront-url/api/score?score=75"

# Low score - triggers event processing
curl "https://your-cloudfront-url/api/score?score=25"

# Missing score - triggers event processing
curl "https://your-cloudfront-url/api/score"
```

### Expected Responses

**High Score (≥50):**
```json
{
  "message": "Score validation passed",
  "score": 75,
  "status": "success",
  "timestamp": "2025-07-02T12:00:00.000Z"
}
```

**Low Score (<50):**
```json
{
  "message": "Score validation failed - event sent to processing pipeline",
  "score": "25",
  "action": "EventBridge notification sent",
  "timestamp": "2025-07-02T12:00:00.000Z"
}
```

## Important Notes for Production Use

⚠️ **This is a demonstration project** - The configurations shown here prioritize clarity and learning over production security and performance.

### **Security Considerations**
For production environments, ensure proper configuration of:
- **IAM Policies**: Implement least privilege access principles
- **VPC Configuration**: Deploy Lambda functions in private subnets
- **API Gateway Security**: Add authentication, rate limiting, and request validation
- **CloudFront Security**: Configure WAF rules and security headers
- **Environment Variables**: Use AWS Secrets Manager or Parameter Store for sensitive data

### **Architecture Separation**
Consider separating components into multiple stacks for production:
- **Network Stack**: VPC, subnets, security groups
- **Shared Resources Stack**: EventBridge bus, SQS queues
- **API Stack**: API Gateway, Lambda functions
- **Frontend Stack**: CloudFront, S3 bucket
- **Monitoring Stack**: CloudWatch dashboards, alarms

### **Performance & Reliability**
- **Lambda Configuration**: Optimize memory allocation and timeout settings
- **EventBridge Rules**: Add input transformers and error handling
- **SQS Configuration**: Set appropriate visibility timeout and message retention
- **CloudFront Caching**: Configure proper TTL values for your use case

### **Monitoring & Observability**
Implement comprehensive monitoring:
- **Lambda Duration**: Response time optimization
- **EventBridge Invocations**: Event processing volume
- **SQS Queue Depth**: Processing lag indicators
- **DLQ Message Count**: Error rate monitoring
- **Custom Metrics**: Business-specific KPIs

## Architecture Decisions

### Fire-and-Forget vs Awaited EventBridge

**Current Implementation (Fire-and-Forget):**
```javascript
// Non-blocking EventBridge call - don't wait for response
eventBridge.send(command).catch(error => {
    console.error('EventBridge failed:', error);
    // User response not affected
});
return response; // Immediate response
```

**Alternative (Awaited):**
```javascript
// Wait for EventBridge response before continuing
await eventBridge.send(command);
return response; // Delayed response
```

**Trade-offs:**
- **Fire-and-Forget**: Faster response (50-100ms) but no delivery guarantee to user
- **Awaited**: Slower response (200-500ms) but guaranteed event delivery

### **Direct Lambda vs SQS Integration**

**Current**: API Gateway → Lambda1 (Direct)  
**Alternative**: API Gateway → SQS → Lambda1 (Indirect)

**Benefits of Direct Integration:**
- Immediate score validation
- Real-time user feedback
- Simpler error handling

## Development

### Project Structure
```
├── bin/cdk-eventbridge-lambda-pattern.ts    # CDK app entry
├── lib/cdk-eventbridge-lambda-pattern-stack.ts # Infrastructure
├── lambda/
│   ├── sample-lambda-1/index.js            # Score validator
│   └── sample-lambda-2/index.js            # Event processor
├── web/index.html                          # Test interface
└── test/                                   # Unit tests
```

### Local Development
```bash
# Watch for changes
npm run watch

# Run tests
npm test

# Check differences before deploy
cdk diff

# Deploy specific stack
cdk deploy BackendStack
```

### Cleanup
```bash
# Remove all resources
cdk destroy --all
```

## License

MIT License

---

This project demonstrates patterns and solutions based on real-world implementation challenges. For production use, please ensure proper security configurations, stack separation, and comprehensive monitoring as outlined in the production considerations section.