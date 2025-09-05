# Azure 存储 API 使用指南

这个项目包含了两个 Azure Functions，分别演示了如何使用 Azure 表存储和 Blob 存储。

## 配置

在 `local.settings.json` 中设置你的 Azure 存储连接字符串：

```json
{
  "Values": {
    "AZURE_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net"
  }
}
```

## 表存储 API (Table Storage)

### 基础路径
`/api/table`

### 操作

#### 1. 创建用户 (POST)
```bash
curl -X POST "http://localhost:7071/api/table" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "department": "engineering", 
    "name": "张三",
    "email": "zhangsan@example.com",
    "age": 30
  }'
```

#### 2. 获取特定用户 (GET)
```bash
curl "http://localhost:7071/api/table?userId=user123&department=engineering"
```

#### 3. 获取部门所有用户 (GET)
```bash
curl "http://localhost:7071/api/table?department=engineering"
```

#### 4. 更新用户 (PUT)
```bash
curl -X PUT "http://localhost:7071/api/table" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "department": "engineering",
    "name": "张三（更新）",
    "email": "zhangsan.updated@example.com",
    "age": 31
  }'
```

#### 5. 删除用户 (DELETE)
```bash
curl -X DELETE "http://localhost:7071/api/table?userId=user123&department=engineering"
```

## Blob 存储 API (Blob Storage)

### 基础路径
`/api/blob`

### 操作

#### 1. 上传文件 (POST)
```bash
# 上传文本文件
curl -X POST "http://localhost:7071/api/blob?blobName=test.txt" \
  -H "Content-Type: text/plain" \
  --data "这是一个测试文件的内容"

# 上传二进制文件
curl -X POST "http://localhost:7071/api/blob?blobName=image.jpg" \
  -H "Content-Type: image/jpeg" \
  --data-binary @"/path/to/your/image.jpg"
```

#### 2. 下载文件 (GET)
```bash
curl "http://localhost:7071/api/blob?blobName=test.txt"
```

#### 3. 列出所有文件 (GET)
```bash
curl "http://localhost:7071/api/blob"
```

#### 4. 删除文件 (DELETE)
```bash
curl -X DELETE "http://localhost:7071/api/blob?blobName=test.txt"
```

## 运行项目

1. 安装依赖：
```bash
npm install
```

2. 构建项目：
```bash
npm run build
```

3. 启动函数：
```bash
npm start
```

函数将在 `http://localhost:7071` 上运行。

## 数据结构

### 表存储用户实体
```typescript
interface UserEntity {
  partitionKey: string;  // 部门名称
  rowKey: string;        // 用户ID
  name: string;          // 姓名
  email: string;         // 邮箱
  age: number;           // 年龄
}
```

### Blob 存储响应
```typescript
// 上传响应
{
  message: "Blob uploaded successfully",
  blobName: string,
  requestId: string,
  etag: string,
  lastModified: Date,
  url: string
}

// 列表响应
{
  blobs: [
    {
      name: string,
      size: number,
      lastModified: Date,
      contentType: string
    }
  ],
  count: number
}
```