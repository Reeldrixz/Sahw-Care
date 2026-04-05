# CareCircle — Setup Guide

## Prerequisites

1. **Node.js 18+** — https://nodejs.org
2. **PostgreSQL** — https://postgresql.org (or use a cloud provider like Neon, Supabase, Railway)
3. **Cloudinary account** — https://cloudinary.com (free tier works)

---

## 1. Install dependencies

```bash
cd carecircle
npm install
```

---

## 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/carecircle"
JWT_SECRET="generate-a-32-char-random-string-here"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

To generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Or use migrations (production)
npm run db:migrate
```

---

## 4. Create an admin user

After starting the app and registering, promote yourself to ADMIN via Prisma Studio:

```bash
npm run db:studio
```

Then find your user and set `role = ADMIN`.

---

## 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (email or phone + password) |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | List items (filter: category, search, location, donorId) |
| POST | `/api/items` | Create listing (auth required) |
| GET | `/api/items/:id` | Get item detail |
| PUT | `/api/items/:id` | Update item (owner or admin) |
| DELETE | `/api/items/:id` | Delete item (owner or admin) |

### Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests?type=sent\|received` | Get my requests |
| POST | `/api/requests` | Request an item |
| PUT | `/api/requests/:id` | Approve / Reject / Fulfill |

### Conversations & Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | My conversations |
| GET | `/api/conversations/:id/messages` | Messages in conversation |
| POST | `/api/conversations/:id/messages` | Send message |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload image → Cloudinary URL |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/profile` | Update name/location |

### Admin (ADMIN role required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/:id` | Update user status/role |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/items` | All items |
| PUT | `/api/admin/items/:id` | Approve/remove item |
| DELETE | `/api/admin/items/:id` | Delete item |

---

## Notes

- Items are created with `status: PENDING` and must be approved by an admin before appearing in browse.
- When a donor approves a request, a Conversation is automatically created between donor and recipient.
- Chat works via polling — consider adding WebSocket support (Pusher, Ably) for real-time messaging in production.
