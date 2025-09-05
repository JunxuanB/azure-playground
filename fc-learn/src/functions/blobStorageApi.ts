import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient, ContainerClient, BlockBlobClient } from "@azure/storage-blob";

// Connection string should be set in local.settings.json or environment variables
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "documents";

export async function blobStorageApi(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Blob Storage API processed request for url "${request.url}"`);

    if (!connectionString) {
        return {
            status: 500,
            body: JSON.stringify({ error: "Azure Storage connection string not configured" })
        };
    }

    const blobServiceClient = new BlobServiceClient(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    try {
        // Ensure container exists
        await containerClient.createIfNotExists({
            access: 'blob'
        });
    } catch (error: any) {
        context.log("Container creation result:", error);
    }

    const method = request.method.toUpperCase();

    try {
        switch (method) {
            case 'GET':
                return await handleGetRequest(request, containerClient, context);
            case 'POST':
                return await handlePostRequest(request, containerClient, context);
            case 'DELETE':
                return await handleDeleteRequest(request, containerClient, context);
            default:
                return {
                    status: 405,
                    body: JSON.stringify({ error: "Method not allowed" })
                };
        }
    } catch (error: any) {
        context.error("Error in blob storage operation:", error);
        return {
            status: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message })
        };
    }
}

async function handleGetRequest(request: HttpRequest, containerClient: ContainerClient, context: InvocationContext): Promise<HttpResponseInit> {
    const blobName = request.query.get('blobName');

    if (blobName) {
        // Download specific blob
        try {
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const downloadResponse = await blockBlobClient.download();
            
            if (!downloadResponse.readableStreamBody) {
                return {
                    status: 404,
                    body: JSON.stringify({ error: "Blob not found or empty" })
                };
            }

            const chunks: Buffer[] = [];
            
            // Convert readable stream to buffer
            for await (const chunk of downloadResponse.readableStreamBody!) {
                chunks.push(Buffer.from(chunk));
            }

            const content = Buffer.concat(chunks);
            const properties = await blockBlobClient.getProperties();
            
            return {
                status: 200,
                headers: {
                    'Content-Type': properties.contentType || 'application/octet-stream',
                    'Content-Length': properties.contentLength?.toString() || '0'
                },
                body: content
            };
        } catch (error: any) {
            if (error.statusCode === 404) {
                return {
                    status: 404,
                    body: JSON.stringify({ error: "Blob not found" })
                };
            }
            throw error;
        }
    } else {
        // List all blobs in container
        const blobs = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            blobs.push({
                name: blob.name,
                size: blob.properties.contentLength,
                lastModified: blob.properties.lastModified,
                contentType: blob.properties.contentType
            });
        }
        
        return {
            status: 200,
            body: JSON.stringify({ blobs, count: blobs.length })
        };
    }
}

async function handlePostRequest(request: HttpRequest, containerClient: ContainerClient, context: InvocationContext): Promise<HttpResponseInit> {
    const blobName = request.query.get('blobName');
    const contentType = request.headers.get('content-type') || 'application/octet-stream';

    if (!blobName) {
        return {
            status: 400,
            body: JSON.stringify({ error: "Missing required parameter: blobName" })
        };
    }

    try {
        const body = await request.arrayBuffer();
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        const uploadResponse = await blockBlobClient.upload(body, body.byteLength, {
            blobHTTPHeaders: {
                blobContentType: contentType
            },
            metadata: {
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'azure-function'
            }
        });
        
        return {
            status: 201,
            body: JSON.stringify({ 
                message: "Blob uploaded successfully",
                blobName,
                requestId: uploadResponse.requestId,
                etag: uploadResponse.etag,
                lastModified: uploadResponse.lastModified,
                url: blockBlobClient.url
            })
        };
    } catch (error: any) {
        throw error;
    }
}

async function handleDeleteRequest(request: HttpRequest, containerClient: ContainerClient, context: InvocationContext): Promise<HttpResponseInit> {
    const blobName = request.query.get('blobName');

    if (!blobName) {
        return {
            status: 400,
            body: JSON.stringify({ error: "Missing required parameter: blobName" })
        };
    }

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const deleteResponse = await blockBlobClient.delete({
            deleteSnapshots: 'include'
        });
        
        return {
            status: 200,
            body: JSON.stringify({ 
                message: "Blob deleted successfully",
                blobName,
                requestId: deleteResponse.requestId
            })
        };
    } catch (error: any) {
        if (error.statusCode === 404) {
            return {
                status: 404,
                body: JSON.stringify({ error: "Blob not found" })
            };
        }
        throw error;
    }
}

app.http('blobStorageApi', {
    methods: ['GET', 'POST', 'DELETE'],
    authLevel: 'anonymous',
    route: 'blob/{*segments}',
    handler: blobStorageApi
});