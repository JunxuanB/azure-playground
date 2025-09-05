import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient, TableEntity, odata } from "@azure/data-tables";

interface UserEntity extends TableEntity {
    partitionKey: string;
    rowKey: string;
    name: string;
    email: string;
    age: number;
}

// Connection string should be set in local.settings.json or environment variables
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

export async function tableStorageApi(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Table Storage API processed request for url "${request.url}"`);

    if (!connectionString) {
        return {
            status: 500,
            body: JSON.stringify({ error: "Azure Storage connection string not configured" })
        };
    }

    const tableClient = new TableClient(connectionString, "users");
    
    try {
        // Ensure table exists
        await tableClient.createTable();
    } catch (error: any) {
        // Table might already exist, ignore error
        context.log("Table creation result:", error);
    }

    const method = request.method.toUpperCase();

    try {
        switch (method) {
            case 'GET':
                return await handleGetRequest(request, tableClient, context);
            case 'POST':
                return await handlePostRequest(request, tableClient, context);
            case 'PUT':
                return await handlePutRequest(request, tableClient, context);
            case 'DELETE':
                return await handleDeleteRequest(request, tableClient, context);
            default:
                return {
                    status: 405,
                    body: JSON.stringify({ error: "Method not allowed" })
                };
        }
    } catch (error: any) {
        context.error("Error in table storage operation:", error);
        return {
            status: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message })
        };
    }
}

async function handleGetRequest(request: HttpRequest, tableClient: TableClient, context: InvocationContext): Promise<HttpResponseInit> {
    const userId = request.query.get('userId');
    const department = request.query.get('department') || 'default';

    if (userId) {
        // Get specific user
        try {
            const entity = await tableClient.getEntity<UserEntity>(department, userId);
            return {
                status: 200,
                body: JSON.stringify(entity)
            };
        } catch (error) {
            if (error.statusCode === 404) {
                return {
                    status: 404,
                    body: JSON.stringify({ error: "User not found" })
                };
            }
            throw error;
        }
    } else {
        // Get all users in department
        const entities = tableClient.listEntities<UserEntity>({
            queryOptions: { filter: odata`PartitionKey eq ${department}` }
        });
        
        const users = [];
        for await (const entity of entities) {
            users.push(entity);
        }
        
        return {
            status: 200,
            body: JSON.stringify({ users, count: users.length })
        };
    }
}

async function handlePostRequest(request: HttpRequest, tableClient: TableClient, context: InvocationContext): Promise<HttpResponseInit> {
    const body = await request.json() as any;
    const { userId, department = 'default', name, email, age } = body;

    if (!userId || !name || !email) {
        return {
            status: 400,
            body: JSON.stringify({ error: "Missing required fields: userId, name, email" })
        };
    }

    const userEntity: UserEntity = {
        partitionKey: department,
        rowKey: userId,
        name,
        email,
        age: age || 0
    };

    await tableClient.createEntity(userEntity);
    
    return {
        status: 201,
        body: JSON.stringify({ message: "User created successfully", user: userEntity })
    };
}

async function handlePutRequest(request: HttpRequest, tableClient: TableClient, context: InvocationContext): Promise<HttpResponseInit> {
    const body = await request.json() as any;
    const { userId, department = 'default', name, email, age } = body;

    if (!userId) {
        return {
            status: 400,
            body: JSON.stringify({ error: "Missing required field: userId" })
        };
    }

    const userEntity: UserEntity = {
        partitionKey: department,
        rowKey: userId,
        name,
        email,
        age: age || 0
    };

    await tableClient.upsertEntity(userEntity, "Replace");
    
    return {
        status: 200,
        body: JSON.stringify({ message: "User updated successfully", user: userEntity })
    };
}

async function handleDeleteRequest(request: HttpRequest, tableClient: TableClient, context: InvocationContext): Promise<HttpResponseInit> {
    const userId = request.query.get('userId');
    const department = request.query.get('department') || 'default';

    if (!userId) {
        return {
            status: 400,
            body: JSON.stringify({ error: "Missing required parameter: userId" })
        };
    }

    try {
        await tableClient.deleteEntity(department, userId);
        return {
            status: 200,
            body: JSON.stringify({ message: "User deleted successfully" })
        };
    } catch (error) {
        if (error.statusCode === 404) {
            return {
                status: 404,
                body: JSON.stringify({ error: "User not found" })
            };
        }
        throw error;
    }
}

app.http('tableStorageApi', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    route: 'table/{*segments}',
    handler: tableStorageApi
});