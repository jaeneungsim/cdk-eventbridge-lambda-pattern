import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

// WAF Stack (us-east-1)
export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'WebACL',
      },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
      ],
    });
  }
}

// Backend Stack - EventBridge + SQS + Lambda (Sydney)
export class BackendStack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // EventBridge Custom Bus
    this.eventBus = new events.EventBus(this, 'ScoreProcessingEventBus', {
      eventBusName: 'score-processing-bus'
    });

    // Dead Letter Queue for low score processing
    const lowScoreProcessingDLQ = new sqs.Queue(this, 'LowScoreProcessingDLQ', {
      queueName: 'low-score-processing-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS Queue for low score processing (triggered by EventBridge)
    const lowScoreProcessingQueue = new sqs.Queue(this, 'LowScoreProcessingQueue', {
      queueName: 'low-score-processing-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: lowScoreProcessingDLQ,
        maxReceiveCount: 3,
      },
    });

    // Lambda functions
    const lambdaFunction1 = new lambda.Function(this, 'ScoreValidatorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/sample-lambda-1'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
    });

    const lambdaFunction2 = new lambda.Function(this, 'LowScoreProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/sample-lambda-2'),
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions
    this.eventBus.grantPutEventsTo(lambdaFunction1);
    lowScoreProcessingQueue.grantConsumeMessages(lambdaFunction2);

    // Configure SQS as event source for Lambda2
    lambdaFunction2.addEventSource(new eventsources.SqsEventSource(lowScoreProcessingQueue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(5),
      reportBatchItemFailures: true,
    }));

    // EventBridge rule to send events to SQS
    const lowScoreEventRule = new events.Rule(this, 'LowScoreEventRule', {
      eventBus: this.eventBus,
      ruleName: 'low-score-processing-rule',
      description: 'Routes low score events to SQS for processing',
      eventPattern: {
        source: ['lambda.score-processor'],
        detailType: ['Low Score Event'],
      },
      targets: [new targets.SqsQueue(lowScoreProcessingQueue)],
    });

    // No API Gateway role needed - direct Lambda integration

    // API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'ScoreProcessingApi', {
      restApiName: 'Score Processing API',
      description: 'API Gateway with EventBridge integration for score validation',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Lambda Integration
    const lambdaIntegration1 = new apigateway.LambdaIntegration(lambdaFunction1);
    
    // Add /api resource and sub-resources
    const api = this.apiGateway.root.addResource('api');
    const lambda1Resource = api.addResource('score');
    
    // Add GET method for Lambda1
    lambda1Resource.addMethod('GET', lambdaIntegration1);

    // Output EventBus name and Queue URL for monitoring
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'EventBridge Bus Name',
    });

    new cdk.CfnOutput(this, 'LowScoreProcessingQueueUrl', {
      value: lowScoreProcessingQueue.queueUrl,
      description: 'SQS Queue URL for low score processing',
    });
  }
}

// Frontend Stack - S3 & CloudFront (Sydney)
export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    apiGateway: apigateway.RestApi;
    webAcl: wafv2.CfnWebACL;
  }) {
    super(scope, id, props);

    // S3 Bucket for static website
    this.bucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Origin
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    // API Gateway Origin
    const apiOrigin = new origins.RestApiOrigin(props.apiGateway);

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: 'index.html',
      webAclId: props.webAcl.attrArn,
    });

    // Deploy web assets to S3 with CloudFront invalidation
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('web')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
    });
  }
}


// Main Stack - deprecated, kept for compatibility
export class CdkEventbridgeLambdaPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // This stack is now empty - resources moved to separate stacks
  }
}
