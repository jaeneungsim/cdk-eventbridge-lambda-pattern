#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WafStack, BackendStack, FrontendStack } from '../lib/cdk-eventbridge-lambda-pattern-stack';

const app = new cdk.App();

// WAF Stack (us-east-1 - required for CloudFront)
const wafStack = new WafStack(app, 'WafStack', {
  env: { region: 'us-east-1' },
  crossRegionReferences: true,
});

// Backend Stack (Sydney)
const backendStack = new BackendStack(app, 'BackendStack', {
  env: { region: 'ap-southeast-2' },
  crossRegionReferences: true,
});

// Frontend Stack (Sydney with cross-region references)
const frontendStack = new FrontendStack(app, 'FrontendStack', {
  env: { region: 'ap-southeast-2' },
  crossRegionReferences: true,
  apiGateway: backendStack.apiGateway,
  webAcl: wafStack.webAcl,
});

// Dependencies
frontendStack.addDependency(wafStack);
frontendStack.addDependency(backendStack);