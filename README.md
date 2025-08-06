# Freelance Marketplace Backend

A robust RESTful API backend for the freelance marketplace built with Node.js, Express, and MongoDB.

## 🚀 Features

- **RESTful API**: Complete CRUD operations for all entities
- **Authentication**: JWT-based authentication with role-based access
- **File Upload**: Image upload with Multer and file processing
- **Real-time Messaging**: WebSocket support for live chat
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Request validation with express-validator
- **Error Handling**: Comprehensive error handling and logging
- **Security**: CORS, rate limiting, and security headers

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Real-time**: Socket.io
- **Validation**: express-validator
- **Security**: bcryptjs, helmet, cors

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/freelance-marketplace-backend.git
   cd freelance-marketplace-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/freelance-marketplace
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=30d
   COOKIE_EXPIRE=30
   ```

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database named `freelance-marketplace`

5. **Run the server**
   ```bash
   npm start
   ```

6. **API will be available at**
   `http://localhost:5000/api`

## 🏗️ Project Structure

```
server/
├── controllers/          # Route controllers
│   ├── admin/           # Admin-specific controllers
│   ├── authController.js
│   ├── gigController.js
│   ├── messageController.js
│   ├── orderController.js
│   └── reviewController.js
├── middlewares/         # Custom middleware
│   ├── auth.js         # Authentication middleware
│   ├── async.js        # Async error handler
│   └── upload.js       # File upload middleware
├── models/             # Mongoose models
│   ├── User.js
│   ├── Gig.js
│   ├── Order.js
│   ├── Review.js
│   ├── Message.js
│   └── Conversation.js
├── routes/             # API routes
│   ├── admin/          # Admin routes
│   ├── auth.js
│   ├── gigs.js
│   ├── messages.js
│   ├── orders.js
│   └── reviews.js
├── uploads/            # Uploaded files
├── scripts/            # Database scripts
└── src/                # Additional source files
```

## 🔐 Authentication

### User Roles
- **freelancer**: Can create and manage gigs
- **client**: Can browse and order gigs  
- **admin**: Can manage the platform

### JWT Token Flow
1. User logs in with email/password
2. Server validates credentials
3. JWT token generated and sent as HTTP-only cookie
4. Token used for subsequent authenticated requests

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Gigs
- `GET /api/gigs` - Get all gigs (public)
- `GET /api/gigs/:id` - Get single gig (public)
- `POST /api/gigs` - Create gig (freelancer only)
- `PUT /api/gigs/:id` - Update gig (owner only)
- `DELETE /api/gigs/:id` - Delete gig (owner only)
- `GET /api/gigs/user/me` - Get user's gigs (freelancer only)

### Orders
- `GET /api/orders` - Get user's orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

### Messages
- `GET /api/messages` - Get conversations
- `POST /api/messages` - Send message
- `GET /api/messages/:conversationId` - Get conversation messages

### Reviews
- `GET /api/reviews` - Get reviews
- `POST /api/reviews` - Create review
- `GET /api/reviews/user/:userId` - Get user reviews

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Get all users
- `GET /api/admin/gigs` - Get all gigs
- `GET /api/admin/orders` - Get all orders

## 🔄 Development

```bash
# Start development server
npm start

# Start with nodemon (auto-restart)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Seed database
node scripts/seedDemoData.js
```

## 🗄️ Database Models

### User
- Basic info (name, email, password)
- Role (freelancer, client, admin)
- Profile data (bio, skills, location)
- Statistics (earnings, ratings, etc.)

### Gig
- Title, description, category
- Pricing and delivery time
- Images and requirements
- Seller reference

### Order
- Gig and buyer references
- Status tracking
- Payment information
- Delivery timeline

### Message/Conversation
- Real-time messaging
- File attachments
- Read receipts

## 🔒 Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Tokens**: Secure authentication
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Request validation
- **File Upload Security**: File type and size validation

## 📊 Database Scripts

- `scripts/createDevUser.js` - Create development users
- `scripts/seedDemoData.js` - Seed demo data
- `scripts/checkUsers.js` - Check user data

## 🚀 Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-production-jwt-secret
JWT_EXPIRE=30d
COOKIE_EXPIRE=30
```

### Platforms
- **Heroku**: Easy deployment with Git
- **Railway**: Modern deployment platform
- **DigitalOcean**: VPS deployment
- **AWS**: EC2 or Lambda deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Frontend Repository](https://github.com/yourusername/freelance-marketplace-frontend)
- [API Documentation](https://your-api-docs-url.com)
- [Live Demo](https://your-demo-url.com)

## 📞 Support

For support, email support@yourdomain.com or create an issue in this repository. 