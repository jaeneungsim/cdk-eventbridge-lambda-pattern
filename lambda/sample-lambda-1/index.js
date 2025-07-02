const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('=== LAMBDA DEBUG START ===');
    console.log('Full Event:', JSON.stringify(event, null, 2));
    console.log('Event type:', typeof event);
    console.log('Event constructor:', event.constructor.name);
    console.log('Event prototype:', Object.getPrototypeOf(event));
    console.log('=== LAMBDA DEBUG END ===');
    
    try {
        // Extract score from query parameters
        const score = event.queryStringParameters?.score;
        
        console.log(`Received score parameter: "${score}" (type: ${typeof score})`);
        console.log('Query parameters:', JSON.stringify(event.queryStringParameters));
        console.log('Event keys:', Object.keys(event));
        
        // Debug: check if queryStringParameters exists
        if (!event.queryStringParameters) {
            console.log('WARNING: queryStringParameters is null or undefined');
            console.log('Event.queryStringParameters:', event.queryStringParameters);
        }
        
        // Convert score to number for validation
        const scoreNumber = score ? parseInt(score, 10) : null;
        console.log(`Parsed score: ${scoreNumber} (original: "${score}")`);
        
        // Validate score parameter - improved logic
        if (score === null || score === undefined || score === '' || isNaN(scoreNumber) || scoreNumber < 50) {
            console.log('Score is missing or less than 50, sending event to EventBridge');
            
            // Send event to EventBridge
            const eventDetail = {
                source: 'sample-lambda-1',
                score: score || 'missing',
                timestamp: new Date().toISOString(),
                requestId: event.requestContext?.requestId,
                reason: !score ? 'Score parameter missing' : 'Score less than 50'
            };
            
            // Send event to EventBridge asynchronously (removed await for faster response)
            eventBridge.send(new PutEventsCommand({
                Entries: [{
                    Source: 'lambda.score-processor',
                    DetailType: 'Low Score Event',
                    Detail: JSON.stringify(eventDetail),
                    EventBusName: process.env.EVENT_BUS_NAME
                }]
            })).catch(error => {
                console.error('Failed to send event to EventBridge:', error);
                // Event sending failure doesn't affect user response
            });
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Score validation failed - event sent to processing pipeline',
                    score: score || 'missing',
                    scoreNumber: scoreNumber,
                    action: 'EventBridge notification sent',
                    timestamp: new Date().toISOString(),
                    debug: {
                        originalScore: score,
                        scoreType: typeof score,
                        queryParams: event.queryStringParameters
                    }
                })
            };
        }
        
        // Score is 50 or above
        console.log(`Score is 50 or above (${scoreNumber}), processing normally`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Score validation passed',
                score: scoreNumber,
                status: 'success',
                timestamp: new Date().toISOString(),
                debug: {
                    originalScore: score,
                    scoreType: typeof score,
                    queryParams: event.queryStringParameters
                }
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};