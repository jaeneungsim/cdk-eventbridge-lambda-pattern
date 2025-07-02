exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Process SQS messages from EventBridge
    const results = [];
    
    for (const record of event.Records) {
        try {
            console.log(`Processing message: ${record.messageId}`);
            
            // Parse message body - EventBridge events are wrapped in SQS
            let messageBody;
            try {
                messageBody = JSON.parse(record.body);
            } catch (e) {
                console.log('Message body is not JSON, treating as plain text');
                messageBody = { rawMessage: record.body };
            }
            
            console.log('Message body:', messageBody);
            
            // Extract EventBridge event details if present
            let eventDetails = null;
            if (messageBody.detail) {
                eventDetails = typeof messageBody.detail === 'string' 
                    ? JSON.parse(messageBody.detail) 
                    : messageBody.detail;
            }
            
            // Process the low score event
            const processedData = {
                messageId: record.messageId,
                receiptHandle: record.receiptHandle,
                processingTime: new Date().toISOString(),
                processedBy: 'sample-lambda-2',
                eventSource: messageBody.source || 'unknown',
                eventDetails: eventDetails,
                action: 'Low score event processed',
                enhancedProcessing: {
                    notificationSent: true,
                    alertLevel: eventDetails?.score === 'missing' ? 'HIGH' : 'MEDIUM',
                    followUpRequired: true,
                    processingId: `proc-${Date.now()}`
                }
            };
            
            console.log('Low score event processed successfully:', processedData);
            results.push(processedData);
            
        } catch (error) {
            console.error(`Error processing message ${record.messageId}:`, error);
            
            // Return batch item failure for this specific message
            results.push({
                itemIdentifier: record.messageId,
                error: error.message
            });
        }
    }
    
    console.log(`Processed ${results.length} low score events from sample-lambda-2`);
    
    // Return batch item failures if any
    const failures = results.filter(result => result.error);
    if (failures.length > 0) {
        return {
            batchItemFailures: failures.map(failure => ({
                itemIdentifier: failure.itemIdentifier
            }))
        };
    }
    
    return {
        statusCode: 200,
        processedCount: results.length,
        results: results
    };
};