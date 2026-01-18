# OpenCode 架构图表

## 系统架构图

### 整体架构

```mermaid
flowchart TB
    subgraph Clients["客户端层"]
        CLI["CLI 终端"]
        Web["Web 界面"]
        Desktop["桌面应用"]
        SDK["SDK"]
    end

    subgraph Server["服务器层"]
        HTTP["Hono HTTP Server"]
        API["API Routes"]
        Auth["认证中间件"]
    end

    subgraph Core["核心引擎"]
        Session["会话管理"]
        Message["消息处理"]
        LLM["LLM 调用"]
        ToolSys["工具系统"]
    end

    subgraph Storage["存储层"]
        SQLite["SQLite"]
        Config["配置文件"]
    end

    subgraph External["外部服务"]
        AI["AI Provider"]
        LSP["LSP Server"]
        MCP["MCP Server"]
    end

    CLI --> HTTP
    Web --> HTTP
    Desktop --> HTTP
    SDK --> HTTP

    HTTP --> API
    API --> Auth
    Auth --> Session

    Session --> Message
    Message --> LLM
    LLM --> ToolSys
    ToolSys --> Storage

    LLM --> AI
    ToolSys --> LSP
    ToolSys --> MCP
```

### 客户端架构

```mermaid
flowchart LR
    subgraph CLI_Client["CLI 客户端"]
        TUI["终端界面"]
        Parser["参数解析"]
        RPC["RPC 调用"]
    end

    subgraph Web_Client["Web 客户端"]
        UI["SolidJS UI"]
        Router["路由"]
        State["状态管理"]
        API["API 客户端"]
    end

    subgraph Desktop_Client["桌面客户端"]
        Native["Tauri 原生"]
        Window["窗口管理"]
        Tray["系统托盘"]
    end

    TUI --> Parser
    Parser --> RPC
    UI --> Router
    Router --> State
    State --> API
    Native --> Window
    Native --> Tray
```

## 数据流图

### 消息处理流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant C as 客户端
    participant S as 服务器
    participant P as 处理器
    participant L as LLM
    participant T as 工具系统
    participant D as 数据库

    U->>C: 输入消息
    C->>S: 发送请求
    S->>P: 接收消息
    P->>D: 存储消息
    P->>L: 调用 LLM
    alt 需要工具调用
        L->>T: 返回工具调用
        T->>T: 权限检查
        T->>T: 执行工具
        T->>L: 返回结果
        L->>P: 生成响应
    else 直接响应
        L->>P: 生成响应
    end
    P->>D: 保存响应
    P->>C: 流式返回
    C->>U: 显示结果
```

### 工具执行流程

```mermaid
flowchart TB
    Start["LLM 返回工具调用"] --> Check{"权限检查"}

    Check -->|允许| Validate["参数验证"]
    Check -->|询问| Ask["提示用户"]
    Check -->|拒绝| End["拒绝执行"]

    Ask -->|允许| Validate
    Ask -->|拒绝| End

    Validate --> Route{"路由到工具"}

    Route --> Bash["bash 工具"]
    Route --> File["文件工具"]
    Route --> Search["搜索工具"]
    Route --> LSP["LSP 工具"]
    Route --> Custom["自定义工具"]

    Bash --> Execute["执行"]
    File --> Execute
    Search --> Execute
    LSP --> Execute
    Custom --> Execute

    Execute --> Format["格式化输出"]
    Format --> Result["返回结果"]
```

## 数据库模型

### 核心表关系

```mermaid
erDiagram
    Project ||--o{ Session : contains
    Session ||--o{ Message : contains
    Message ||--o{ Part : contains
    Session ||--o{ Todo : has

    Project {
        string id PK
        string directory
        string title
        timestamp created_at
        timestamp updated_at
    }

    Session {
        string id PK
        string project_id FK
        string parent_id
        string slug
        string directory
        string title
        string version
        string share_url
        json permission
        json summary
        timestamp created_at
        timestamp updated_at
    }

    Message {
        string id PK
        string session_id FK
        json data
        timestamp created_at
    }

    Part {
        string id PK
        string message_id FK
        string session_id
        json data
        timestamp created_at
    }

    Todo {
        string session_id FK
        string content
        string status
        string priority
        int position
        timestamp created_at
        timestamp updated_at
    }
```

### 数据流转

```mermaid
flowchart LR
    subgraph Input["输入"]
        UserInput["用户输入"]
        FileChange["文件变更"]
        Command["命令"]
    end

    subgraph Process["处理"]
        Parse["解析"]
        Validate["验证"]
        Transform["转换"]
    end

    subgraph Storage["存储"]
        SessionDB["会话库"]
        Cache["缓存"]
        Log["日志"]
    end

    subgraph Output["输出"]
        Response["响应"]
        Action["操作"]
        Notification["通知"]
    end

    Input --> Process
    Process --> Storage
    Storage --> Output
```

## 模块依赖

### 核心模块依赖图

```mermaid
flowchart TB
    subgraph Entry["入口"]
        Index["index.ts"]
    end

    subgraph CLI["CLI 层"]
        Cmd["命令模块"]
        UI["UI 模块"]
    end

    subgraph Server["服务器层"]
        ServerFile["server.ts"]
        Routes["路由"]
        Middleware["中间件"]
    end

    subgraph Core["核心层"]
        Session["会话"]
        Message["消息"]
        LLM["LLM"]
    end

    subgraph Tool["工具层"]
        Registry["注册表"]
        Executor["执行器"]
        Tools["内置工具"]
    end

    subgraph Provider["提供商层"]
        Manager["管理器"]
        Models["模型"]
    end

    subgraph Infra["基础设施"]
        Config["配置"]
        Storage["存储"]
        Auth["认证"]
    end

    Index --> Cmd
    Index --> ServerFile
    Cmd --> UI
    ServerFile --> Routes
    ServerFile --> Middleware
    Routes --> Session
    Session --> Message
    Message --> LLM
    LLM --> Tool
    Tool --> Registry
    Tool --> Executor
    Registry --> Tools
    LLM --> Provider
    Provider --> Manager
    Provider --> Models
    ServerFile --> Config
    Config --> Storage
    Config --> Auth
```

### 工具注册流程

```mermaid
flowchart TB
    Start["启动"] --> Init["初始化"]

    Init --> Builtin["加载内置工具"]
    Init --> Custom["加载自定义工具"]
    Init --> Plugin["加载插件工具"]
    Init --> MCP["加载 MCP 工具"]

    Builtin --> Register["注册到注册表"]
    Custom --> Register
    Plugin --> Register
    MCP --> Register

    Register --> Config["读取配置"]
    Config --> Filter["过滤工具"]
    Filter --> Ready["就绪"]
```

## 部署架构

### 开发环境

```mermaid
flowchart TB
    subgraph Dev["开发环境"]
        DevMachine["开发者机器"]
        OpenCode["OpenCode CLI"]
        Server["本地服务器 :4096"]
        DB["SQLite 本地"]
    end

    subgraph Cloud["云服务"]
        AI["AI Provider"]
    end

    DevMachine --> OpenCode
    OpenCode --> Server
    Server --> DB
    Server --> AI
```

### 生产环境

```mermaid
flowchart TB
    subgraph Users["用户"]
        Web["Web 浏览器"]
        Desktop["桌面应用"]
        Mobile["移动设备"]
    end

    subgraph Network["网络层"]
        CDN["CDN"]
        LB["负载均衡"]
    end

    subgraph Servers["服务器集群"]
        S1["Server 1"]
        S2["Server 2"]
        S3["Server N"]
    end

    subgraph Data["数据层"]
        DB["数据库集群"]
        Cache["Redis 缓存"]
        Object["对象存储"]
    end

    subgraph External["外部服务"]
        AI["AI Provider"]
        Auth["认证服务"]
    end

    Web --> CDN
    Desktop --> LB
    Mobile --> LB

    CDN --> LB
    LB --> Servers

    Servers <--> DB
    Servers <--> Cache
    Servers <--> Object

    Servers --> AI
    Servers --> Auth
```

## 状态机

### 会话状态

```mermaid
stateDiagram-v2
    [*] --> Init: 创建会话
    Init --> Active: 开始交互
    Active --> Waiting: 等待响应
    Waiting --> Active: 接收完成
    Active --> Paused: 暂停
    Paused --> Active: 恢复
    Active --> Archived: 归档
    Archived --> [*]

    Active --> Error: 发生错误
    Error --> Active: 重试
    Error --> Failed: 失败
    Failed --> [*]
```

### 工具执行状态

```mermaid
stateDiagram-v2
    [*] --> Pending: 创建调用

    Pending --> Authorized: 权限通过
    Pending --> Denied: 权限拒绝
    Pending --> Prompted: 需要确认

    Authorized --> Running: 执行中
    Prompted --> Authorized: 用户允许
    Prompted --> Denied: 用户拒绝

    Running --> Success: 执行成功
    Running --> Error: 执行失败
    Running --> Timeout: 超时

    Success --> [*]
    Error --> [*]
    Timeout --> [*]
    Denied --> [*]
```

## 组件图

### 工具组件

```mermaid
classDiagram
    class Tool {
        <<interface>>
        +id: string
        +init() ToolInstance
    }

    class ToolInstance {
        <<interface>>
        +description: string
        +parameters: zod
        +execute(args, ctx) Result
    }

    class ToolRegistry {
        +state() RegistryState
        +register(tool) void
        +tools(model, agent) Tool[]
    }

    class ToolExecutor {
        +execute(call, ctx) Result
        +validate(call) boolean
        +authorize(call) boolean
    }

    Tool <|.. BashTool
    Tool <|.. ReadTool
    Tool <|.. WriteTool
    Tool <|.. EditTool
    Tool <|.. GlobTool
    Tool <|.. GrepTool
    Tool <|.. LspTool

    ToolRegistry --> Tool
    ToolExecutor --> Tool
```

### Provider 组件

```mermaid
classDiagram
    class Provider {
        <<interface>>
        +id: string
        +createModel(options) LanguageModel
    }

    class ProviderManager {
        +list() ProviderInfo[]
        +get(id) Provider
        +createModel(providerID, modelID) Model
    }

    class Model {
        +providerID: string
        +modelID: string
        +complete(messages) Result
        +stream(messages) Stream
    }

    Provider <|.. OpenAIProvider
    Provider <|.. AnthropicProvider
    Provider <|.. GoogleProvider
    Provider <|.. AzureProvider

    ProviderManager --> Provider
    ProviderManager --> Model
```

## 请求流程

### API 请求流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant M as 中间件
    participant R as 路由
    participant V as 验证器
    participant H as 处理器
    participant D as 数据库

    C->>M: HTTP 请求
    M->>M: 日志记录
    M->>M: CORS 处理
    M->>M: 认证检查
    M->>R: 路由分发

    R->>V: 参数验证
    V->>H: 业务处理

    H->>D: 数据操作
    D-->>H: 返回结果

    H-->>C: HTTP 响应
```

## 监控指标

### 关键指标

```mermaid
flowchart LR
    subgraph Metrics["监控指标"]
        subgraph Performance["性能"]
            P1["响应时间"]
            P2["吞吐量"]
            P3["错误率"]
        end

        subgraph Usage["使用情况"]
            U1["会话数"]
            U2["消息数"]
            U3["工具调用数"]
        end

        subgraph Resource["资源"]
            R1["CPU 使用"]
            R2["内存使用"]
            R3["磁盘 I/O"]
        end
    end
```
