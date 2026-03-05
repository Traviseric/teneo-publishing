export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "monospace", maxWidth: 800, margin: "0 auto" }}>
      <h1>Teneo Publishing</h1>
      <p>AI agent content publishing API. Pay per use via Lightning L402 or Cashu ecash.</p>

      <h2>Endpoints</h2>
      <ul>
        <li><code>GET /api/capabilities</code> — discover capabilities and pricing</li>
        <li><code>POST /api/publish</code> — execute a publishing capability</li>
        <li><code>GET /api/usage</code> — usage analytics (admin)</li>
        <li><code>POST /api/ai-invoke/publish</code> — TE ecosystem AI-to-AI</li>
      </ul>

      <h2>Quick Start</h2>
      <pre>{`// 1. Check capabilities
GET /api/capabilities

// 2. Generate content (payment required)
POST /api/publish
{
  "capability": "content-generate",
  "purpose": "blog post for merchant site",
  "content": "Write about Bitcoin privacy for small businesses",
  "options": { "format": "markdown" }
}

// Headers:
// Authorization: Cashu <token>   (or L402 <macaroon>:<preimage>)
// x-service-key: te_svc_...      (for TE ecosystem agents)`}</pre>
    </main>
  );
}
