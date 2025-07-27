# Lottery System Backend

🌍 [中文版](README_zh.md) | English

A complete lottery system backend service supporting multiple lottery modes, built with Node.js + Express.js + MySQL.
Provides OpenAPI-compliant JSON protocol documentation for easy API viewing and testing by frontend developers.

## Features

- 🎯 **Multiple Lottery Modes**: Supports online and offline lottery
- 🔐 **Permission Management**: Super admin and regular admin roles
- 🎫 **Lottery Code System**: Supports multiple lottery code generation formats
- 🔗 **Webhook Support**: Third-party systems can add lottery codes via Webhook
- 📊 **Complete Statistics**: Detailed lottery records and statistical data
- 🛡️ **Secure & Reliable**: JWT authentication, operation logs, error handling

## Tech Stack

- **Backend Framework**: Node.js + Express.js
- **Database**: MySQL 8.0+
- **ORM**: Sequelize
- **Authentication**: JWT
- **Logging**: Winston
- **Validation**: express-validator

## Installation and Usage

### 1. Requirements

- Node.js >= 16.0.0
- MySQL >= 8.0
- npm or yarn

### 2. Install Dependencies

```bash
pnpm install
```

### 3. System Initialization

On first startup, the system will automatically enter the installation program to guide you through database configuration, admin account creation, and other setup steps.

If installation fails, you can use the automated installation script:

```bash
pnpm run install-system
```

The installation script will guide you through:
- Configuring database connection
- Creating database and table structure
- Setting up super admin account
- Generating configuration files

### 4. Start Service

```bash
# Production mode
pnpm start

# Development mode
pnpm dev
```

### 5. Test API

Run automated tests to ensure the system works properly:

```bash
pnpm test
```

## Lottery Code Format Support

The system supports the following lottery code formats:

| Format Code | Description | Example |
|-------------|-------------|----------|
| `4_digit_number` | 4-digit numbers only | 1234 |
| `8_digit_number` | 8-digit numbers only | 12345678 |
| `8_digit_alphanumeric` | 8-digit numbers + lowercase letters | 12a34b56 |
| `12_digit_number` | 12-digit numbers only | 123456789012 |
| `12_digit_alphanumeric` | 12-digit numbers + letters | 12a34B56c78D |

## API Usage Examples
Please refer to the API documentation. OpenAPI protocol is provided, and you can import `openapi.json` into Swagger UI or other API tools for testing.

### Admin Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### Create Activity

```bash
curl -X POST http://localhost:3000/api/admin/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Spring Festival Lottery",
    "description": "Spring Festival celebration with great prizes",
    "lottery_mode": "online",
    "start_time": "2024-02-01T00:00:00.000Z",
    "end_time": "2024-02-15T23:59:59.000Z",
    "settings": {
      "max_lottery_codes": 1000,
      "lottery_code_format": "8_digit_number"
    }
  }'
```

### Batch Create Lottery Codes

```bash
curl -X POST http://localhost:3000/api/admin/activities/1/lottery-codes/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "count": 100
  }'
```

### User Lottery Draw

```bash
curl -X POST http://localhost:3000/api/lottery/activities/1/draw \
  -H "Content-Type: application/json" \
  -d '{
    "lottery_code": "12345678"
  }'
```

## Webhook Integration

### Get Webhook Information

```bash
curl -X GET http://localhost:3000/api/admin/activities/1/webhook-info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Lottery Codes via Webhook

```bash
curl -X POST http://localhost:3000/api/webhook/activities/WEBHOOK_ID/lottery-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WEBHOOK_TOKEN" \
  -d '{
    "code": "87654321",
    "participant_info": {
      "name": "John Doe",
      "phone": "13800138000",
      "email": "zhangsan@example.com"
    }
  }'
```

## Directory Structure

```
backend-2/
├── src/
│   ├── app.js                 # Application entry
│   ├── config/
│   │   └── database.js        # Database configuration
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   ├── errorHandler.js   # Error handling
│   │   └── operationLogger.js # Operation logging
│   ├── models/               # Data models
│   │   ├── User.js
│   │   ├── Activity.js
│   │   ├── Prize.js
│   │   ├── LotteryCode.js
│   │   ├── LotteryRecord.js
│   │   └── OperationLog.js
│   ├── routes/               # Routes
│   │   ├── auth.js          # Authentication routes
│   │   ├── admin/           # Admin routes
│   │   ├── lottery.js       # Lottery routes
│   │   ├── webhook.js       # Webhook routes
│   │   └── system.js        # System management routes
│   └── utils/               # Utility functions
│       ├── logger.js
│       ├── customError.js
│       └── lotteryCodeGenerator.js
├── scripts/
│   ├── install.js           # Installation script
│   └── test-apis.js         # API testing script
├── logs/                    # Log files
├── config/                  # Configuration files
├── package.json
└── README.md
```

## Environment Variables

The system requires the following environment variables at runtime (automatically generated by installation script):

```env
# Server configuration
PORT=3000
NODE_ENV=production

# Database configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lottery_system
DB_USER=root
DB_PASSWORD=your_password

# JWT configuration
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# Logging configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Development Notes
### Adding New Lottery Code Formats

1. Add new format in `src/utils/lotteryCodeGenerator.js`
2. Update validation rules
3. Update API documentation

## Troubleshooting
### View Logs

```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log
```

## Contributing

1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

## Contact

For questions or suggestions, please contact the development team.