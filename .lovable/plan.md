
# Add Product Details to Projects

## What's Being Added

Five new fields will be added to the project creation form and project detail view:

1. **Product Name** — dropdown, values managed by admin from a dedicated product catalog table
2. **Product Version** — free-text input
3. **Number of Users** — numeric input
4. **Number of Channels** — numeric input
5. **Trunk** — free-text input
6. **Location** — free-text input

A new admin-only **Product Catalog** section will be added in Settings so admins can add/remove product names from the dropdown.

---

## Database Changes (Migration)

### New Table: `product_catalog`

Stores the list of products that appear in the dropdown.

```text
id          uuid  (primary key)
name        text  (unique, not null)
is_active   boolean (default true)
created_by  uuid
created_at  timestamptz
```

RLS Policies:
- Admins: full CRUD
- All authenticated users: SELECT (so the dropdown works for engineers viewing their assigned projects)

### Extend `projects` Table

Add six new nullable columns:

| Column | Type |
|---|---|
| `product_id` | uuid (FK → product_catalog.id) |
| `product_version` | text |
| `num_users` | integer |
| `num_channels` | integer |
| `trunk` | text |
| `location` | text |

---

## Files Changed

### 1. `src/pages/Projects.tsx`
- Add product fields to the "Create Project" dialog form:
  - Product Name → Select dropdown (fetched from `product_catalog`)
  - Product Version → text input
  - No. of Users → number input
  - No. of Channels → number input
  - Trunk → text input
  - Location → text input
- Fetch the product catalog list on dialog open

### 2. `src/pages/ProjectDetail.tsx`
- Add a new "Product Details" info card section below the existing metadata cards
- Display: Product Name, Product Version, Users, Channels, Trunk, Location

### 3. `src/pages/SettingsPage.tsx`
- Add a new **"Product Catalog"** tab/section (admin-only)
- Admin can:
  - View existing product names
  - Add a new product name
  - Toggle active/inactive (soft delete)

---

## How It Looks in the UI

**Create Project dialog** — new section added below Description:

```text
[ Product Name ▼ ]   [ Product Version  ]
[ No. of Users    ]   [ No. of Channels  ]
[ Trunk           ]   [ Location         ]
```

**Project Detail page** — new card "Product Details":

```text
┌─────────────────────────────────────────────┐
│  Product Details                            │
│  Product: Haloocom UC  v2.1                 │
│  Users: 150    Channels: 24    Trunk: SIP   │
│  Location: Dubai HQ                         │
└─────────────────────────────────────────────┘
```

**Settings page** — new "Product Catalog" section (admin only):

```text
┌─────────────────────────────────────────────┐
│  Product Catalog                [+ Add]     │
│  • Haloocom UC        [Active]  [Remove]    │
│  • Haloocom CC        [Active]  [Remove]    │
│  • Haloocom Messaging [Active]  [Remove]    │
└─────────────────────────────────────────────┘
```

---

## Implementation Steps

1. Run database migration — create `product_catalog` table and add 6 new columns to `projects`
2. Update `SettingsPage.tsx` — add Product Catalog management for admins
3. Update `Projects.tsx` — add product fields to the create dialog
4. Update `ProjectDetail.tsx` — display product details card
