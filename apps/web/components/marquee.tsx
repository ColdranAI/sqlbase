"use client"

import Marquee from "react-fast-marquee"
import { Database, Play } from "lucide-react"

const queries = [
  "SELECT * FROM users WHERE last_login > '2024-01-01'",
  "UPDATE products SET price = price * 1.1 WHERE category = 'electronics'",
  "INSERT INTO orders (user_id, total, status) VALUES (123, 299.99, 'pending')",
  "DELETE FROM sessions WHERE expires_at < NOW()",
  "SELECT COUNT(*) FROM analytics WHERE event_type = 'purchase'",
  "ALTER TABLE customers ADD COLUMN preferred_language VARCHAR(10)",
  "CREATE INDEX idx_user_email ON users(email)",
  "SELECT AVG(rating) FROM reviews WHERE product_id IN (SELECT id FROM products WHERE featured = true)",
  "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 456",
  "SELECT * FROM logs WHERE level = 'ERROR' AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
  "INSERT INTO notifications (user_id, message, type) VALUES (789, 'Welcome!', 'welcome')",
  "SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id"
]

const QueryItem = ({ query }: { query: string }) => (
  <div className="flex items-center gap-3 bg-neutral-900/50 backdrop-blur-sm border border-neutral-800/50 rounded-sm px-4 py-3 mx-3 shadow-lg">
    <div className="flex items-center gap-2 text-emerald-400 flex-shrink-0">
      <Database className="h-4 w-4" />
      <Play className="h-3 w-3" />
    </div>
    <code className="text-neutral-200 font-mono text-sm whitespace-nowrap">
      {query}
    </code>
  </div>
)

export function QueryMarquee() {
  return (
    <div className="w-full bg-neutral-950 py-8 overflow-hidden border-y border-neutral-800/50">
      <Marquee
        gradient={true}
        gradientColor="rgb(10, 10, 10)"
        gradientWidth={50}
        speed={25}
        pauseOnHover={true}
        className="py-2 overflow-y-hidden"
      >
        {queries.map((query, index) => (
          <QueryItem key={index} query={query} />
        ))}
      </Marquee>
      
      {/* Second row going in opposite direction for more visual interest */}
      <div>
        <Marquee
          gradient={true}
          gradientColor="rgb(10, 10, 10)"
          gradientWidth={50}
          speed={20}
          direction="right"
          pauseOnHover={true}
          className="py-2 overflow-y-hidden
"
        >
          {queries.slice().reverse().map((query, index) => (
            <QueryItem key={`reverse-${index}`} query={query} />
          ))}
        </Marquee>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-neutral-600 text-xs">
          SQL Queries • Hover to pause
        </p>
      </div>
    </div>
  )
} 