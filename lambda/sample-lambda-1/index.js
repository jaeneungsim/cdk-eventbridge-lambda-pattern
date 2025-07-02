const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract score from query parameters
        const score = event.queryStringParameters?.score;
        
        console.log(`Received score parameter: ${score}`);
        
        // Validate score parameter
        if (!score || isNaN(score) || parseInt(score) < 50) {
            console.log('Score is missing or less than 50, sending event to EventBridge');
            
            // Send event to EventBridge
            const eventDetail = {
                source: 'sample-lambda-1',
                score: score || 'missing',
                timestamp: new Date().toISOString(),
                requestId: event.requestContext?.requestId,
                reason: !score ? 'Score parameter missing' : 'Score less than 50'
            };
            
            await eventBridge.send(new PutEventsCommand({
                Entries: [{
                    Source: 'lambda.score-processor',
                    DetailType: 'Low Score Event',
                    Detail: JSON.stringify(eventDetail),
                    EventBusName: process.env.EVENT_BUS_NAME
                }]
            }));
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Score validation failed - event sent to processing pipeline',
                    score: score || 'missing',
                    action: 'EventBridge notification sent',
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // Score is 50 or above
        console.log('Score is 50 or above, processing normally');
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Score validation passed',
                score: parseInt(score),
                status: 'success',
                timestamp: new Date().toISOString()
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