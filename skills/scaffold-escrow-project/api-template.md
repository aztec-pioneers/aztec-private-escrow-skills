# Orderflow API Templates

## packages/api/src/types/api.ts

```typescript
export interface Order {
  orderId: string;
  escrowAddress: string;
  contractInstance: string;
  secretKey: string;
  sellTokenAddress: string;
  sellTokenAmount: BigInt;
  buyTokenAddress: string;
  buyTokenAmount: BigInt;
}

export interface CreateOrderRequest {
  escrowAddress: string;
  sellTokenAddress: string;
  contractInstance: string;
  secretKey: string;
  sellTokenAmount: BigInt;
  buyTokenAddress: string;
  buyTokenAmount: BigInt;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export type RequestHandler = (req: Request) => Promise<Response>;
```

## packages/api/src/db/interface.ts

```typescript
import type { Order } from "../types/api";

export interface IDatabase {
  initialize(): void;
  escrowAddressExists(escrowAddress: string): boolean;
  insertOrder(order: Order): Order;
  getOrderById(orderId: string): Order | null;
  getOrderByEscrowAddress(escrowAddress: string): Order | null;
  getAllOrders(): Order[];
  closeOrder(orderId: string): boolean;
  getOrdersWithFilters(filters: {
    escrowAddress?: string;
    sellTokenAddress?: string;
    buyTokenAddress?: string;
  }): Order[];
  close(): void;
}
```

## packages/api/src/db/sqlite.ts

```typescript
import { Database } from "bun:sqlite";
import type { Order } from "../types/api";
import type { IDatabase } from "./interface";

export class SQLiteDatabase implements IDatabase {
  private db: Database;

  constructor(filename: string = "orders.sqlite") {
    this.db = new Database(filename);
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        orderId TEXT PRIMARY KEY,
        escrowAddress TEXT NOT NULL UNIQUE,
        contractInstance TEXT NOT NULL,
        secretKey TEXT NOT NULL,
        sellTokenAddress TEXT NOT NULL,
        sellTokenAmount TEXT NOT NULL,
        buyTokenAddress TEXT NOT NULL,
        buyTokenAmount TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  escrowAddressExists(escrowAddress: string): boolean {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM orders WHERE escrowAddress = ?");
    const result = stmt.get(escrowAddress) as { count: number };
    return result.count > 0;
  }

  insertOrder(order: Order): Order {
    if (this.escrowAddressExists(order.escrowAddress)) {
      throw new Error(`Order with escrow address ${order.escrowAddress} already exists`);
    }
    const stmt = this.db.prepare(`
      INSERT INTO orders (orderId, escrowAddress, contractInstance, secretKey, sellTokenAddress, sellTokenAmount, buyTokenAddress, buyTokenAmount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(order.orderId, order.escrowAddress, order.contractInstance, order.secretKey,
      order.sellTokenAddress, order.sellTokenAmount.toString(),
      order.buyTokenAddress, order.buyTokenAmount.toString());
    return order;
  }

  getOrderById(orderId: string): Order | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE orderId = ?").get(orderId) as any;
    return row ? this.mapRowToOrder(row) : null;
  }

  getOrderByEscrowAddress(escrowAddress: string): Order | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE escrowAddress = ?").get(escrowAddress) as any;
    return row ? this.mapRowToOrder(row) : null;
  }

  getAllOrders(): Order[] {
    return (this.db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all() as any[])
      .map(row => this.mapRowToOrder(row));
  }

  closeOrder(orderId: string): boolean {
    return this.db.prepare("DELETE FROM orders WHERE orderId = ?").run(orderId).changes > 0;
  }

  getOrdersWithFilters(filters: { escrowAddress?: string; sellTokenAddress?: string; buyTokenAddress?: string }): Order[] {
    let query = "SELECT * FROM orders WHERE 1=1";
    const params: string[] = [];
    if (filters.escrowAddress) { query += " AND escrowAddress = ?"; params.push(filters.escrowAddress); }
    if (filters.sellTokenAddress) { query += " AND sellTokenAddress = ?"; params.push(filters.sellTokenAddress); }
    if (filters.buyTokenAddress) { query += " AND buyTokenAddress = ?"; params.push(filters.buyTokenAddress); }
    query += " ORDER BY createdAt DESC";
    return (this.db.prepare(query).all(...params) as any[]).map(row => this.mapRowToOrder(row));
  }

  close(): void { this.db.close(); }

  private mapRowToOrder(row: any): Order {
    return {
      orderId: row.orderId, escrowAddress: row.escrowAddress,
      contractInstance: row.contractInstance, secretKey: row.secretKey,
      sellTokenAddress: row.sellTokenAddress, sellTokenAmount: BigInt(row.sellTokenAmount),
      buyTokenAddress: row.buyTokenAddress, buyTokenAmount: BigInt(row.buyTokenAmount),
    };
  }
}
```

## packages/api/src/db/index.ts

```typescript
export type { IDatabase } from "./interface";
export { SQLiteDatabase } from "./sqlite";
```

## packages/api/src/utils/uuid.ts

```typescript
export function generateOrderId(): string { return crypto.randomUUID(); }
```

## packages/api/src/utils/serialization.ts

```typescript
import type { Order } from "../types/api";

export function serializeOrder(order: Order): any {
  return { ...order, sellTokenAmount: order.sellTokenAmount.toString(), buyTokenAmount: order.buyTokenAmount.toString() };
}

export function serializeOrders(orders: Order[]): any[] {
  return orders.map(order => serializeOrder(order));
}
```

## packages/api/src/handlers/orderHandlers.ts

```typescript
import type { RequestHandler, ApiResponse, Order, CreateOrderRequest } from "../types/api";
import type { IDatabase } from "../db";
import { generateOrderId } from "../utils/uuid";
import { serializeOrder, serializeOrders } from "../utils/serialization";

export function createOrderHandlers(database: IDatabase) {
  const handleCreateOrder: RequestHandler = async (req) => {
    try {
      const rawData = await req.json();
      const order: Order = {
        orderId: generateOrderId(),
        escrowAddress: rawData.escrowAddress,
        contractInstance: rawData.contractInstance,
        secretKey: rawData.secretKey,
        sellTokenAddress: rawData.sellTokenAddress,
        sellTokenAmount: BigInt(rawData.sellTokenAmount),
        buyTokenAddress: rawData.buyTokenAddress,
        buyTokenAmount: BigInt(rawData.buyTokenAmount),
      };
      const saved = database.insertOrder(order);
      console.log(`Added order #${order.orderId} (address: ${order.escrowAddress})`);
      return Response.json({ success: true, message: "Order created", data: serializeOrder(saved) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create order";
      return Response.json({ success: false, error: msg }, { status: msg.includes("already exists") ? 409 : 500 });
    }
  };

  const handleGetOrder: RequestHandler = async (req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const escrow = url.searchParams.get("escrow_address");
    const sell = url.searchParams.get("sell_token_address");
    const buy = url.searchParams.get("buy_token_address");

    let orders: Order[];
    if (id) {
      const order = database.getOrderById(id);
      if (!order) return Response.json({ success: false, error: "Not found", data: [] }, { status: 404 });
      orders = [order];
    } else if (escrow || sell || buy) {
      const filters: any = {};
      if (escrow) filters.escrowAddress = escrow;
      if (sell) filters.sellTokenAddress = sell;
      if (buy) filters.buyTokenAddress = buy;
      orders = database.getOrdersWithFilters(filters);
    } else {
      orders = database.getAllOrders();
    }
    return Response.json({ success: true, message: `Retrieved ${orders.length} order(s)`, data: serializeOrders(orders) });
  };

  const handleCloseOrder: RequestHandler = async (req) => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return new Response("Order parameter not supplied", { status: 400 });
    const success = database.closeOrder(id);
    return success
      ? new Response(`Order #${id} closed`, { status: 204 })
      : new Response(`Order #${id} not found`, { status: 404 });
  };

  return { handleCreateOrder, handleGetOrder, handleCloseOrder };
}
```

## packages/api/src/handlers/index.ts

```typescript
export { createOrderHandlers } from "./orderHandlers";
```

## packages/api/src/index.ts

```typescript
import { createOrderHandlers } from "./handlers";
import { SQLiteDatabase } from "./db";

const database = new SQLiteDatabase();
database.initialize();

const { handleCreateOrder, handleGetOrder, handleCloseOrder } = createOrderHandlers(database);

const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/order") {
      switch (req.method) {
        case "POST": return handleCreateOrder(req);
        case "GET": return handleGetOrder(req);
        case "DELETE": return handleCloseOrder(req);
        default: return new Response("Method Not Allowed", { status: 405 });
      }
    }
    if (req.method === "GET" && url.pathname === "/health") return new Response("OK");
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Orderflow Service running on http://localhost:${server.port}`);
process.on('SIGINT', () => { database.close(); process.exit(0); });
process.on('SIGTERM', () => { database.close(); process.exit(0); });
```
